package iam

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/admission"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStandaloneIAMAdmissionSearch(t *testing.T) {
	b := NewAPIService(
		nil, nil, legacysql.NewDatabaseProvider(nil),
		&NoopApiInstaller[*iamv0.RoleBinding]{ResourceInfo: iamv0.RoleBindingInfo},
		&NoopApiInstaller[*iamv0.Role]{ResourceInfo: iamv0.RoleInfo},
		&NoopApiInstaller[*iamv0.GlobalRole]{ResourceInfo: iamv0.GlobalRoleInfo},
		&NoopApiInstaller[*iamv0.TeamLBACRule]{ResourceInfo: iamv0.TeamLBACRuleInfo},
		nil, prometheus.NewRegistry(), nil, nil, tracing.InitializeTracerForTest(),
		resourcepermission.NewMappersRegistry(), nil, Features{UsersAPI: true, TeamsAPI: true},
	)
	b.store = standaloneAdmissionTestStore{}

	scheme := runtime.NewScheme()
	require.NoError(t, b.InstallSchema(scheme))
	codecs := serializer.NewCodecFactory(scheme)
	group := genericapiserver.NewDefaultAPIGroupInfo(iamv0.GROUP, scheme, metav1.ParameterCodec, codecs)
	mode := dualwrite.NewMockService(t)
	client := resourceclient.NewMockResourceClient(t)
	getter := apistore.NewRESTOptionsGetterForClient(client, nil, storagebackend.Config{Codec: codecs.LegacyCodec(iamv0.SchemeGroupVersion)}, nil, nil)
	require.NoError(t, b.UpdateAPIGroupInfo(&group, builder.APIGroupOptions{
		Scheme: scheme, OptsGetter: getter, StorageOptsRegister: getter.RegisterOptions,
		DualWriteService: mode,
		DualWriteBuilder: func(_ schema.GroupResource, legacy, _ grafanarest.Storage) (grafanarest.Storage, error) {
			return legacy, nil
		},
	}))
	require.NotNil(t, b.userSearchClient)
	require.NotNil(t, b.teamSearchClient)

	const namespace = "stacks-11"
	ctx := identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeAccessPolicy, Namespace: namespace, OrgRole: types.RoleAdmin})
	validate := func(obj runtime.Object, gvk schema.GroupVersionKind, gvr schema.GroupVersionResource) error {
		return b.Validate(ctx, admission.NewAttributesRecord(obj, nil, gvk, namespace, "new", gvr, "", admission.Create, nil, false, nil), nil)
	}
	u := &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: "new", Namespace: namespace}, Spec: iamv0.UserSpec{Role: "Viewer"}}
	teamObj := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "new", Namespace: namespace}}
	validateUser := func() error {
		return validate(u, iamv0.UserResourceInfo.GroupVersionKind(), iamv0.UserResourceInfo.GroupVersionResource())
	}
	validateTeam := func() error {
		return validate(teamObj, iamv0.TeamResourceInfo.GroupVersionKind(), iamv0.TeamResourceInfo.GroupVersionResource())
	}
	require.True(t, apierrors.IsBadRequest(validateUser()))
	require.True(t, apierrors.IsBadRequest(validateTeam()))

	// The resources can have different migration modes.
	mode.EXPECT().ReadFromUnified(mock.Anything, iamv0.UserResourceInfo.GroupResource()).Return(false, nil).Times(3)
	mode.EXPECT().ReadFromUnified(mock.Anything, iamv0.TeamResourceInfo.GroupResource()).Return(true, nil).Once()
	client.EXPECT().Search(mock.Anything, mock.MatchedBy(func(req *resourcepb.ResourceSearchRequest) bool {
		return req.GetOptions().GetKey().GetNamespace() == namespace && req.GetOptions().GetKey().GetResource() == "teams"
	})).Return(&resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES}, nil).Once()

	u.Spec.Login, u.Spec.Email = "new-login", "new@example.invalid"
	teamObj.Spec.Title = "New team"
	require.NoError(t, validateUser())
	require.NoError(t, validateTeam())
	u.Spec.Login = "existing-login"
	require.True(t, apierrors.IsConflict(validateUser()))
	u.Spec.Login, u.Spec.Email = "new-login", "existing@example.invalid"
	require.True(t, apierrors.IsConflict(validateUser()))

	mode.EXPECT().ReadFromUnified(mock.Anything, iamv0.TeamResourceInfo.GroupResource()).Return(false, nil).Once()
	teamObj.Spec.Title = "Existing team"
	require.True(t, apierrors.IsConflict(validateTeam()))
}

type standaloneAdmissionTestStore struct{ legacy.LegacyIdentityStore }

func (standaloneAdmissionTestStore) ListUsers(_ context.Context, _ types.NamespaceInfo, q legacy.ListUserQuery) (*legacy.ListUserResult, error) {
	if q.Login == "existing-login" || q.Email == "existing@example.invalid" {
		return &legacy.ListUserResult{Items: []common.UserWithRole{{User: user.User{UID: "existing"}}}}, nil
	}
	return &legacy.ListUserResult{}, nil
}

func (standaloneAdmissionTestStore) ListTeams(_ context.Context, _ types.NamespaceInfo, q legacy.ListTeamQuery) (*legacy.ListTeamResult, error) {
	if q.Name == "Existing team" {
		return &legacy.ListTeamResult{Teams: []team.Team{{UID: "existing"}}}, nil
	}
	return &legacy.ListTeamResult{}, nil
}
