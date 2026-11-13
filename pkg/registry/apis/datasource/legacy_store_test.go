package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

// managedDataSource returns a data source carrying the manager annotations.
func managedDataSource(t *testing.T, kind utils.ManagerKind, identity string) *datasourceV0.DataSource {
	t.Helper()
	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
	}
	meta, err := utils.MetaAccessor(ds)
	require.NoError(t, err)
	meta.SetManagerProperties(utils.ManagerProperties{Kind: kind, Identity: identity})
	return ds
}

func TestPrepareUpdateEnforcesManagerRules(t *testing.T) {
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	provisioningCtx, _, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)
	userCtx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"})

	tests := []struct {
		name      string
		ctx       context.Context
		stored    *datasourceV0.DataSource
		requested *datasourceV0.DataSource
		forbidden bool
	}{
		{
			name:      "provisioner rewriting its own data source",
			ctx:       provisioningCtx,
			stored:    managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
			requested: managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
		},
		{
			name:      "kind change",
			ctx:       provisioningCtx,
			stored:    managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
			requested: managedDataSource(t, utils.ManagerKindTerraform, "my-repo"),
			forbidden: true,
		},
		{
			name:      "identity change",
			ctx:       provisioningCtx,
			stored:    managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
			requested: managedDataSource(t, utils.ManagerKindRepo, "other-repo"),
			forbidden: true,
		},
		{
			name:      "a user may not edit a repo-managed data source directly",
			ctx:       userCtx,
			stored:    managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
			requested: managedDataSource(t, utils.ManagerKindRepo, "my-repo"),
			forbidden: true,
		},
		{
			name:      "an unmanaged data source needs no identity at all",
			ctx:       context.Background(),
			stored:    unmanagedDataSource(),
			requested: unmanagedDataSource(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &countingUpdateDatasourceProvider{stored: tt.stored}
			store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}

			_, err := store.prepareUpdate(tt.ctx, "example", rest.DefaultUpdatedObjectInfo(tt.requested))
			if tt.forbidden {
				require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func unmanagedDataSource() *datasourceV0.DataSource {
	return &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"}}
}

func TestPrepareUpdateRefusesFileProvisionedEdits(t *testing.T) {
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	userCtx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"})
	serviceCtx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authtypes.TypeAccessPolicy, UserUID: "service"})

	fileProvisioned := func(t *testing.T, allowsEdits bool) *datasourceV0.DataSource {
		t.Helper()
		ds := &datasourceV0.DataSource{ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"}}
		meta, err := utils.MetaAccessor(ds)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindClassicFP, //nolint:staticcheck
			Identity:    "prometheus.yaml",
			AllowsEdits: allowsEdits,
		})
		return ds
	}

	tests := []struct {
		name      string
		ctx       context.Context
		stored    *datasourceV0.DataSource
		forbidden bool
	}{
		{
			name:      "a user may not edit one whose config omits editable",
			ctx:       userCtx,
			stored:    fileProvisioned(t, false),
			forbidden: true,
		},
		{
			name:   "editable: true in the config still allows it",
			ctx:    userCtx,
			stored: fileProvisioned(t, true),
		},
		{
			name:   "the provisioner rewriting its own file",
			ctx:    serviceCtx,
			stored: fileProvisioned(t, false),
		},
		{
			name: "a terraform manager is left to its own writer",
			ctx:  userCtx,
			stored: func() *datasourceV0.DataSource {
				return managedDataSource(t, utils.ManagerKindTerraform, "terraform-provider")
			}(),
		},
		{
			name:   "an unmanaged data source is untouched",
			ctx:    context.Background(),
			stored: unmanagedDataSource(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &countingUpdateDatasourceProvider{stored: tt.stored}
			store := &legacyStorage{datasources: provider, resourceInfo: &resourceInfo}

			_, err := store.prepareUpdate(tt.ctx, "example", rest.DefaultUpdatedObjectInfo(tt.stored.DeepCopy()))
			if tt.forbidden {
				require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
				return
			}
			require.NoError(t, err)
		})
	}
}
