package iam

import (
	"fmt"
	"io"
	"reflect"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	legacyiamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
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

// TestCodecPathResourcesRegisterOneVersionPerType guards apimachinery's LegacyCodec version-order
// fallback (see assertNoTypeSpansMultipleGVKs).
func TestCodecPathResourcesRegisterOneVersionPerType(t *testing.T) {
	allOn := map[string]memprovider.InMemoryFlag{}
	for _, flag := range []string{
		featuremgmt.FlagKubernetesAuthzRolesApi,
		featuremgmt.FlagKubernetesAuthzRoleBindingsApi,
		featuremgmt.FlagKubernetesAuthzGlobalRolesApi,
		featuremgmt.FlagKubernetesAuthzTeamLBACRuleApi,
		featuremgmt.FlagKubernetesAuthzResourcePermissionApis,
	} {
		allOn[flag] = memprovider.InMemoryFlag{Key: flag, DefaultVariant: "default", Variants: map[string]any{"default": true}}
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(allOn)))

	scheme := runtime.NewScheme()
	b := &IdentityAccessManagementAPIBuilder{ofClient: openfeature.NewDefaultClient()}
	require.NoError(t, b.InstallSchema(scheme))

	assertNoTypeSpansMultipleGVKs(t, scheme)
}

// commonMultiVersionTypes are known-safe exceptions to assertNoTypeSpansMultipleGVKs: k8s bookkeeping
// types every group-version registers by convention (never round-trip through Storage.Create), plus
// legacyiamv0's SSOSetting/UserTeamList/DisplayList/TeamMemberList, deliberately registered at both
// v0alpha1 and the internal GV to avoid a PATCH/server-side-apply error - none go through
// StorageOptsRegister with Scheme == nil. Add here on exception basis with a description.
var commonMultiVersionTypes = func() map[reflect.Type]bool {
	m := map[reflect.Type]bool{}
	for _, o := range []runtime.Object{
		&metav1.WatchEvent{}, &metav1.InternalEvent{}, &metav1.ListOptions{}, &metav1.GetOptions{},
		&metav1.DeleteOptions{}, &metav1.CreateOptions{}, &metav1.UpdateOptions{}, &metav1.PatchOptions{},
		&metav1.PartialObjectMetadata{}, &metav1.PartialObjectMetadataList{},
		&legacyiamv0.SSOSetting{}, &legacyiamv0.SSOSettingList{}, &legacyiamv0.UserTeamList{},
		&legacyiamv0.DisplayList{}, &legacyiamv0.TeamMemberList{},
	} {
		m[reflect.TypeOf(o).Elem()] = true
	}
	return m
}()

// assertNoTypeSpansMultipleGVKs fails if any type a real InstallSchema registers has 2+
// GroupVersionKinds, or is registered at runtime.APIVersionInternal at all. Either shape activates
// apimachinery's LegacyCodec order-fallback (a type sharing a GVK with the internal version, or with
// another external version, has no exact match in the codec's version list), which would let
// preferred_api_version silently pick the persisted version instead of only discovery order. A
// same-struct hub isn't required: a distinct internal-only struct plus distinct external structs hits
// the same fallback, since the fallback keys on the object's own GVK never exactly matching the
// codec's target list, not on the Go type being reused. Walks every registered type rather than a
// hardcoded list, so a new resource is covered too.
func assertNoTypeSpansMultipleGVKs(t *testing.T, scheme *runtime.Scheme) {
	t.Helper()
	byType := map[reflect.Type][]schema.GroupVersionKind{}
	for gvk, typ := range scheme.AllKnownTypes() {
		if commonMultiVersionTypes[typ] {
			continue
		}
		obj, ok := reflect.New(typ).Interface().(runtime.Object)
		if !ok {
			continue
		}
		if unversioned, ok := scheme.IsUnversioned(obj); ok && unversioned {
			continue // e.g. metav1.Status - genuinely version-independent, not a codec-fallback risk
		}
		require.NotEqualf(t, runtime.APIVersionInternal, gvk.Version,
			"%s is registered at the internal version (%v) - a hub type never exactly matches any "+
				"external version in the LegacyCodec's list, so encoding it always hits the "+
				"order-fallback and lets preferred_api_version pick the persisted version", typ, gvk)
		byType[typ] = append(byType[typ], gvk)
	}
	for typ, gvks := range byType {
		require.Lenf(t, gvks, 1,
			"%s is registered at %v - a Go type shared across group versions activates the LegacyCodec "+
				"order-fallback, so preferred_api_version would now silently pick the persisted version "+
				"for this type instead of only ordering API discovery", typ, gvks)
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
