package migrator

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/converter"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DataSourceMigrator handles migrating datasources from legacy SQL storage.
type DataSourceMigrator interface {
	MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

type dataSourceMigrator struct {
	getter      func(ctx context.Context, namespace string) ([]DataSourceData, error)
	secretStore secret.InlineSecureValueSupport
}

type DataSourceData struct {
	Config *datasources.DataSource
	Secure map[string]string
}

// ProvideDataSourceMigrator creates a dataSourceMigrator for use in wire DI.
func ProvideDataSourceMigrator(
	dsService datasources.DataSourceService,
	secretStore secret.InlineSecureValueSupport,
) DataSourceMigrator {
	return &dataSourceMigrator{
		getter: func(ctx context.Context, namespace string) ([]DataSourceData, error) {
			orgId, err := migrations.ParseOrgIDFromNamespace(namespace)
			if err != nil {
				return nil, err
			}
			dss, err := dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
				OrgID:           orgId,
				DataSourceLimit: 10000,
			})
			if err != nil {
				return nil, err
			}

			result := make([]DataSourceData, len(dss))
			for i, ds := range dss {
				dsSecrets, err := dsService.DecryptedValues(ctx, ds)
				if err != nil {
					return nil, fmt.Errorf("error decrypting existing secrets for datasource %s (type=%s): %w", ds.UID, ds.Type, err)
				}
				result[i] = DataSourceData{
					Config: ds,
					Secure: dsSecrets,
				}
			}
			return result, nil
		},
		secretStore: secretStore,
	}
}

// This is useful for the cloud controller, where we populate values from cloudconfig
func NewDataSourceMigrator(
	getter func(ctx context.Context, namespace string) ([]DataSourceData, error),
	secretStore secret.InlineSecureValueSupport,
) DataSourceMigrator {
	return &dataSourceMigrator{
		getter:      getter,
		secretStore: secretStore,
	}
}

// MigrateDataSources reads datasources from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API. It handles all plugin
// types found in the database, grouping by type and using per-plugin converters.
func (m *dataSourceMigrator) MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating datasources...")
	datasources, err := m.getter(ctx, opts.Namespace)
	if err != nil {
		return err
	}

	// Clean up any existing secrets in the MT secret service
	plugins := map[string]bool{}
	for _, ds := range datasources {
		if !plugins[ds.Config.Type] {
			if err = m.secretStore.DeleteWhenOwnedByResource(ctx, common.ObjectReference{
				APIGroup:   ds.Config.Type + ".datasource.grafana.app",
				APIVersion: datasourceV0.VERSION,
				Namespace:  opts.Namespace,
				Kind:       "DataSource",
				Name:       "*",
				UID:        "*",
			}, "*"); err != nil {
				return fmt.Errorf("error deleting secrets for datasource type %s: %w", ds.Config.Type, err)
			}
		}
		plugins[ds.Config.Type] = true
	}

	namespacer := func(orgId int64) string {
		return opts.Namespace
	}

	for count, info := range datasources {
		ds := info.Config
		group := ds.Type + ".datasource.grafana.app"
		dsConverter := converter.NewConverter(namespacer, group, ds.Type, nil)
		obj, err := dsConverter.AsDataSource(ds)
		if err != nil {
			return fmt.Errorf("converting datasource %s (type=%s): %w", ds.UID, ds.Type, err)
		}

		// Set TypeMeta with the per-plugin group
		obj.TypeMeta = metav1.TypeMeta{
			APIVersion: group + "/" + datasourceV0.VERSION,
			Kind:       "DataSource",
		}

		gv, err := schema.ParseGroupVersion(obj.APIVersion)
		if err != nil {
			return fmt.Errorf("invalid apiVersion: %w", err)
		}

		if len(info.Secure) > 0 {
			objRef := common.ObjectReference{
				APIGroup:   gv.Group,
				APIVersion: gv.Version,
				Kind:       obj.Kind,
				Namespace:  obj.Namespace,
				Name:       obj.Name,
				UID:        obj.UID,
			}
			secure, err := m.createSecrets(ctx, info.Secure, objRef)
			if err != nil {
				return fmt.Errorf("error create secrets for datasource %s (type=%s): %w, %#v", ds.UID, ds.Type, err, obj)
			}
			obj.Secure = secure
		}

		body, err := json.Marshal(obj)
		if err != nil {
			return fmt.Errorf("marshaling datasource %s: %w", ds.UID, err)
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     gv.Group,
				Resource:  "datasources",
				Name:      ds.UID,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s/%s (%d) %s", ds.Type, ds.Name, len(req.Value), req.Key))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	opts.Progress(-2, fmt.Sprintf("finished datasources... (%d)", len(datasources)))
	return nil
}

func (m *dataSourceMigrator) createSecrets(ctx context.Context, dsSecrets map[string]string, objRef common.ObjectReference) (common.InlineSecureValues, error) {
	if len(dsSecrets) == 0 {
		return nil, nil
	}

	values := make(common.InlineSecureValues)
	for k, v := range dsSecrets {
		if v == "" {
			continue // do not create empty secret values
		}
		name, err := m.secretStore.CreateInline(ctx, objRef, common.NewSecretValue(v), nil)
		if err != nil {
			return nil, err
		}
		if name == "" {
			return nil, fmt.Errorf("did not create a new secret")
		}
		values[k] = common.InlineSecureValue{
			Name: name,
		}
	}
	return values, nil
}
