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
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// DataSourceMigrator handles migrating datasources from legacy SQL storage.
type DataSourceMigrator interface {
	MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}

type dataSourceMigrator struct {
	sql             legacysql.LegacyDatabaseProvider
	dsService       datasources.DataSourceService
	secretStore     secret.InlineSecureValueSupport
	namespaceMapper request.NamespaceMapper
}

// ProvideDataSourceMigrator creates a dataSourceMigrator for use in wire DI.
func ProvideDataSourceMigrator(
	sql legacysql.LegacyDatabaseProvider,
	dsService datasources.DataSourceService,
	secretStore secret.InlineSecureValueSupport,
	cfg *setting.Cfg,
) DataSourceMigrator {
	return &dataSourceMigrator{
		sql:             sql,
		dsService:       dsService,
		secretStore:     secretStore,
		namespaceMapper: request.GetNamespaceMapper(cfg),
	}
}

// MigrateDataSources reads datasources from legacy SQL storage and streams them as
// Kubernetes resources to the unified storage bulk process API. It handles all plugin
// types found in the database, grouping by type and using per-plugin converters.
func (m *dataSourceMigrator) MigrateDataSources(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	opts.Progress(-1, "migrating datasources...")
	datasources, err := m.dsService.GetDataSources(ctx, &datasources.GetDataSourcesQuery{
		OrgID:           orgId,
		DataSourceLimit: 10000,
	})
	if err != nil {
		return err
	}

	plugins := map[string]bool{}
	for _, ds := range datasources {
		plugins[ds.Type] = true
	}

	for count, ds := range datasources {
		group := ds.Type + ".datasource.grafana.app"
		dsConverter := converter.NewConverter(m.namespaceMapper, group, ds.Type, nil)
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

		// TODO: this assumes we've cleaned up all secrets from previous migrations.
		dsSecrets, err := m.dsService.DecryptedValues(ctx, ds)
		if err != nil {
			return fmt.Errorf("error decrypting existing secrets for datasource %s (type=%s): %w", ds.UID, ds.Type, err)
		}
		if len(dsSecrets) > 0 {
			objRef := common.ObjectReference{
				APIGroup:   gv.Group,
				APIVersion: gv.Version,
				Kind:       obj.Kind,
				Namespace:  obj.Namespace,
				Name:       obj.Name,
				UID:        obj.UID,
			}
			secure, err := m.createSecrets(ctx, dsSecrets, objRef)
			if err != nil {
				return fmt.Errorf("error create secrets for datasource %s (type=%s): %w, %#v", ds.UID, ds.Type, err, obj)
			}
			obj.Secure = secure
		}

		// Set TypeMeta with the per-plugin group
		obj.TypeMeta = metav1.TypeMeta{
			APIVersion: group + "/" + datasourceV0.VERSION,
			Kind:       "DataSource",
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
		name, err := m.secretStore.CreateInline(ctx, objRef, common.NewSecretValue(v))
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
