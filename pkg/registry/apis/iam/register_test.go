package iam

import (
	"fmt"
	"io"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestInstallSchema_ResourcePermissionsGate(t *testing.T) {
	gvk := iamv0.ResourcePermissionInfo.GroupVersionKind()

	tests := []struct {
		name           string
		flagEnabled    bool
		wantRegistered bool
	}{
		{
			name:           "kind registered when flag enabled",
			flagEnabled:    true,
			wantRegistered: true,
		},
		{
			name:           "kind not registered when flag disabled",
			flagEnabled:    false,
			wantRegistered: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagKubernetesAuthzResourcePermissionApis: {
					Key:            featuremgmt.FlagKubernetesAuthzResourcePermissionApis,
					DefaultVariant: "default",
					Variants:       map[string]any{"default": tt.flagEnabled},
				},
			})
			require.NoError(t, openfeature.SetProviderAndWait(provider))

			b := &IdentityAccessManagementAPIBuilder{ofClient: openfeature.NewDefaultClient()}

			scheme := runtime.NewScheme()
			require.NoError(t, b.InstallSchema(scheme))
			require.Equal(t, tt.wantRegistered, scheme.Recognizes(gvk),
				"ResourcePermission kind registration should match %s=%v", featuremgmt.FlagKubernetesAuthzResourcePermissionApis, tt.flagEnabled)
		})
	}
}

// fixedVersionCodec always encodes to a fixed apiVersion, standing in for a real versioning codec
// (e.g. a LegacyCodec after ReorderGroupVersionsForLegacyCodec) that persists a different version
// than the caller declared. Decode/Identifier are unused on the create path this test exercises.
type fixedVersionCodec struct {
	runtime.Codec
	apiVersion string
}

func (c fixedVersionCodec) Encode(_ runtime.Object, w io.Writer) error {
	_, err := fmt.Fprintf(w, `{"apiVersion":%q,"kind":"GlobalRole","metadata":{"name":"over-cap"}}`, c.apiVersion)
	return err
}

// TestNewLocalStore_EnforcesVersionCap is a regression guard for the fix in NewLocalStore: it used
// to build its RESTOptionsGetter with a nil version policy, so writes through the local-store path
// bypassed the group's maxAllowedVersion cap entirely (unlike the sibling uniStore path). This drives
// a real Create through the store NewLocalStore returns and asserts an over-cap write is now rejected.
func TestNewLocalStore_EnforcesVersionCap(t *testing.T) {
	group := iamv0.GROUP

	vp := versionpolicy.NewVersionPolicyRegistry(
		versionpolicy.NewResolver(map[string][]string{group: {"v1", "v0alpha1"}}),
		map[string]versionpolicy.VersionPolicy{group: {MaxAllowedVersion: "v0alpha1"}},
	)
	// GetRESTOptions never touches the client, only original.Codec/original.EncodeVersioner - so a
	// nil client is fine here; this getter stands in for the outer apiserver's RESTOptionsGetter.
	defaultOptsGetter := apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{
		Codec: fixedVersionCodec{apiVersion: group + "/v1"}, // simulates a codec persisting above the v0alpha1 cap
	}, nil, vp)

	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore:                resource.NewBadgerKV(db),
		DisableStorageServices: true,
	})
	require.NoError(t, err)

	scheme := runtime.NewScheme()
	require.NoError(t, iamv0.AddToScheme(scheme))

	regStore, err := NewLocalStore(iamv0.GlobalRoleInfo, scheme, defaultOptsGetter, prometheus.NewRegistry(), nil, backend, grafanaregistry.SelectableFieldsOptions{})
	require.NoError(t, err)

	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{UserID: 1, UserUID: "u1", Type: authlib.TypeUser})
	key, err := regStore.KeyFunc(ctx, "over-cap")
	require.NoError(t, err)

	obj := &iamv0.GlobalRole{}
	obj.Name = "over-cap"
	out := &iamv0.GlobalRole{}
	err = regStore.Storage.Storage.Create(ctx, key, obj, out, 0)

	require.Error(t, err, "write above the group's maxAllowedVersion cap must be rejected")
	require.True(t, apierrors.IsBadRequest(err), "expected a 4xx, got %v", err)
	require.Contains(t, err.Error(), "v0alpha1", "message should name the cap version")
}
