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
	// PluginGroups returns the distinct per-plugin GroupResources present in the
	// given namespace. Called before opening the bulk stream so every group that
	// MigrateDataSources will write to is pre-authorized — including cloud-only
	// plugin types that are not known at compile time.
	PluginGroups(ctx context.Context, namespace string) ([]schema.GroupResource, error)
}

type dataSourceMigrator struct {
	getter      func(ctx context.Context, namespace string) ([]*datasourceV0.DataSource, error)
	secretStore secret.InlineSecureValueSupport
}

// ProvideDataSourceMigrator creates a dataSourceMigrator for use in wire DI.
func ProvideDataSourceMigrator(
	dsService datasources.DataSourceService,
	secretStore secret.InlineSecureValueSupport,
) DataSourceMigrator {
	return &dataSourceMigrator{
		getter: func(ctx context.Context, namespace string) ([]*datasourceV0.DataSource, error) {
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

			namespacer := func(_ int64) string { return namespace }
			result := make([]*datasourceV0.DataSource, len(dss))
			for i, ds := range dss {
				dsSecrets, err := dsService.DecryptedValues(ctx, ds)
				if err != nil {
					return nil, fmt.Errorf("error decrypting existing secrets for datasource %s (type=%s): %w", ds.UID, ds.Type, err)
				}

				group := ds.Type + ".datasource.grafana.app"
				conv := converter.NewConverter(namespacer, group, ds.Type, nil)
				obj, err := conv.AsDataSource(ds)
				if err != nil {
					return nil, fmt.Errorf("converting datasource %s (type=%s): %w", ds.UID, ds.Type, err)
				}

				// AsDataSource does not set APIVersion when the legacy datasource has none.
				// Set it explicitly so MigrateDataSources can recover the group.
				if obj.APIVersion == "" {
					obj.APIVersion = group + "/" + datasourceV0.VERSION
				}

				// Override Secure with plaintext Create values. AsDataSource sets stub
				// Name-references from SecureJsonData keys; we replace them with actual
				// secret creation requests carrying the decrypted plaintext values.
				obj.Secure = nil
				for k, v := range dsSecrets {
					if v != "" {
						if obj.Secure == nil {
							obj.Secure = make(common.InlineSecureValues)
						}
						obj.Secure[k] = common.InlineSecureValue{Create: common.NewSecretValue(v)}
					}
				}

				result[i] = obj
			}
			return result, nil
		},
		secretStore: secretStore,
	}
}

// This is useful for the cloud controller, where we populate values from cloudconfig
func NewDataSourceMigrator(
	getter func(ctx context.Context, namespace string) ([]*datasourceV0.DataSource, error),
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
	dsList, err := m.getter(ctx, opts.Namespace)
	if err != nil {
		return err
	}

	// Clean up any existing secrets in the MT secret service
	plugins := map[string]bool{}
	for _, ds := range dsList {
		apiGroup := ds.GroupVersionKind().Group
		if !plugins[apiGroup] {
			if err = m.secretStore.DeleteWhenOwnedByResource(ctx, common.ObjectReference{
				APIGroup:   apiGroup,
				APIVersion: datasourceV0.VERSION,
				Namespace:  opts.Namespace,
				Kind:       "DataSource",
				Name:       "*",
				UID:        "*",
			}, "*"); err != nil {
				return fmt.Errorf("error deleting secrets for datasource type %s: %w", apiGroup, err)
			}
		}
		plugins[apiGroup] = true
	}

	for count, ds := range dsList {
		gvk := ds.GroupVersionKind()

		// Shallow-copy the struct so we can set TypeMeta without mutating the slice element.
		obj := *ds
		obj.TypeMeta = metav1.TypeMeta{
			APIVersion: ds.APIVersion,
			Kind:       "DataSource",
		}

		if len(ds.Secure) > 0 {
			objRef := common.ObjectReference{
				APIGroup:   gvk.Group,
				APIVersion: gvk.Version,
				Kind:       "DataSource",
				Namespace:  ds.Namespace,
				Name:       ds.Name,
				UID:        ds.UID,
			}
			secure, err := m.createSecrets(ctx, ds.Secure, objRef)
			if err != nil {
				return fmt.Errorf("error creating secrets for datasource %s (group=%s): %w", ds.Name, gvk.Group, err)
			}
			obj.Secure = secure
		}

		body, err := json.Marshal(obj)
		if err != nil {
			return fmt.Errorf("marshaling datasource %s: %w", ds.Name, err)
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     gvk.Group,
				Resource:  "datasources",
				Name:      ds.Name,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s/%s (%d) %s", gvk.Group, obj.Spec.Title(), len(req.Value), req.Key))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return err
		}
	}

	opts.Progress(-2, fmt.Sprintf("finished datasources... (%d)", len(dsList)))
	return nil
}

func (m *dataSourceMigrator) PluginGroups(ctx context.Context, namespace string) ([]schema.GroupResource, error) {
	dsList, err := m.getter(ctx, namespace)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(dsList))
	result := make([]schema.GroupResource, 0, len(dsList))
	for _, ds := range dsList {
		group := ds.GroupVersionKind().Group
		if group == "" || seen[group] {
			continue
		}
		seen[group] = true
		result = append(result, schema.GroupResource{Group: group, Resource: "datasources"})
	}
	return result, nil
}

func (m *dataSourceMigrator) createSecrets(ctx context.Context, dsSecrets common.InlineSecureValues, objRef common.ObjectReference) (common.InlineSecureValues, error) {
	if len(dsSecrets) == 0 {
		return nil, nil
	}

	values := make(common.InlineSecureValues)
	for k, sv := range dsSecrets {
		if sv.Create.IsZero() {
			continue // skip Name-references and empty entries
		}
		v := sv.Create.DangerouslyExposeAndConsumeValue()
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
	if len(values) == 0 {
		return nil, nil
	}
	return values, nil
}
