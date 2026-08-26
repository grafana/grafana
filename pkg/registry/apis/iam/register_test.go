package iam

import (
	"context"
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
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/display"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/registry/apis/iam/userpermissions"
	"github.com/grafana/grafana/pkg/services/apiserver/versionpolicy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type noopUserPermissionsClient struct{}

func (noopUserPermissionsClient) GetUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) (authlib.GetUserPermissionsResponse, error) {
	return authlib.GetUserPermissionsResponse{}, nil
}

func (noopUserPermissionsClient) InvalidateUserPermissions(context.Context, authlib.AuthInfo, authlib.GetUserPermissionsRequest) error {
	return nil
}

func TestGetAPIRoutes_UserPermissionsGate(t *testing.T) {
	for _, tt := range []struct {
		name    string
		enabled bool
		want    bool
	}{
		{name: "route absent when disabled", enabled: false, want: false},
		{name: "route registered when enabled", enabled: true, want: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAuthzUserPermissions: {
					Key:            featuremgmt.FlagAuthzUserPermissions,
					DefaultVariant: "default",
					Variants:       map[string]any{"default": tt.enabled},
				},
			})
			require.NoError(t, openfeature.SetProviderAndWait(provider))
			t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })

			b := &IdentityAccessManagementAPIBuilder{
				ofClient:        openfeature.NewDefaultClient(),
				display:         display.NewDisplayHandler(),
				userPermissions: userpermissions.NewHandler(noopUserPermissionsClient{}, false),
			}
			routes := b.GetAPIRoutes(legacyiamv0.SchemeGroupVersion)
			found := false
			for _, route := range routes.Namespace {
				if route.Path == "users/~/permissions" {
					found = true
				}
			}
			require.Equal(t, tt.want, found)
		})
	}
}

func TestNewAPIService_WiresLegacyTeamStore(t *testing.T) {
	b := NewAPIService(
		nil,
		nil,
		legacysql.NewDatabaseProvider(nil),
		&NoopApiInstaller[*iamv0.RoleBinding]{ResourceInfo: iamv0.RoleBindingInfo},
		&NoopApiInstaller[*iamv0.Role]{ResourceInfo: iamv0.RoleInfo},
		&NoopApiInstaller[*iamv0.GlobalRole]{ResourceInfo: iamv0.GlobalRoleInfo},
		&NoopApiInstaller[*iamv0.TeamLBACRule]{ResourceInfo: iamv0.TeamLBACRuleInfo},
		nil,
		prometheus.NewRegistry(),
		nil,
		nil,
		tracing.InitializeTracerForTest(),
		resourcepermission.NewMappersRegistry(),
		nil,
	)

	require.NotNil(t, b.legacyTeamStore)
}

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
// fallback: it only lets preferred_api_version reorder the persisted version when a type has no
// exact-match GVK. It runs InstallSchema for real (all gates on) and walks every type it registers,
// so any resource - not just a hardcoded list - fails here if it starts sharing a Go struct across
// versions. See the dashboard package's test of the same name for the other codec-path group.
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

// commonMultiVersionTypes are registered once per group-version by convention (metav1.
// AddToGroupVersion's WatchEvent/options types, and each app's own PartialObjectMetadata(List)
// registration), plus app-specific types deliberately shared across versions. None of these round-trip
// through Storage.Create, so they're not the risk assertNoTypeSpansMultipleGVKs guards against. Adding
// to this list is a conscious, reviewed exception, not a silent pass - any new entry should say why.
var commonMultiVersionTypes = func() map[reflect.Type]bool {
	m := map[reflect.Type]bool{}
	for _, o := range []runtime.Object{
		&metav1.WatchEvent{}, &metav1.InternalEvent{}, &metav1.ListOptions{}, &metav1.GetOptions{},
		&metav1.DeleteOptions{}, &metav1.CreateOptions{}, &metav1.UpdateOptions{}, &metav1.PatchOptions{},
		&metav1.PartialObjectMetadata{}, &metav1.PartialObjectMetadataList{},
		// legacyiamv0.AddKnownTypes(scheme, version) is called for both legacyiamv0.VERSION and
		// runtime.APIVersionInternal (register.go's InstallSchema) "to avoid the error: no kind is
		// registered for the type" on PATCH/server-side-apply - not a codec-path write; none of these
		// go through StorageOptsRegister with Scheme == nil.
		&legacyiamv0.SSOSetting{}, &legacyiamv0.SSOSettingList{}, &legacyiamv0.UserTeamList{},
		&legacyiamv0.DisplayList{}, &legacyiamv0.TeamMemberList{},
	} {
		m[reflect.TypeOf(o).Elem()] = true
	}
	return m
}()

// assertNoTypeSpansMultipleGVKs walks every type a scheme actually knows about (as built by a
// builder's real InstallSchema) and fails if any resource type is registered at 2+
// GroupVersionKinds. apimachinery's LegacyCodec order-fallback only fires for such a type - the "true
// internal/hub Go struct shared across versions" pattern - so this is what would flip
// preferred_api_version from a discovery-only setting into one that silently picks what gets
// persisted. It intentionally covers every registered resource, not a hardcoded list, so a brand new
// resource kind is checked without editing this test.
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
