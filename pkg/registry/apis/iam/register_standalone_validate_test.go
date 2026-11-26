package iam

import (
	"context"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/resourcepermission"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

func TestNewAPIService_ValidatesUserAndTeamCreates(t *testing.T) {
	b := NewAPIService(
		nil,
		nil,
		legacysql.NewDatabaseProvider(db.NewTestStore(t)),
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
		Features{UsersAPI: true, TeamsAPI: true},
	)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:           authlib.TypeUser,
		OrgID:          1,
		OrgRole:        authlib.RoleAdmin,
		IsGrafanaAdmin: true,
		Namespace:      "default",
	})
	ns, err := authlib.ParseNamespace("default")
	require.NoError(t, err)

	_, err = b.store.CreateUser(ctx, ns, legacy.CreateUserCommand{UID: "existing", Login: "taken", Email: "taken@example.com", Role: "Viewer"})
	require.NoError(t, err)
	_, err = b.store.CreateTeam(ctx, ns, legacy.CreateTeamCommand{UID: "existing-team", Name: "Taken Team"})
	require.NoError(t, err)

	validateCreate := func(obj runtime.Object, resource string, name string) error {
		attrs := admission.NewAttributesRecord(obj, nil, obj.GetObjectKind().GroupVersionKind(), "default", name,
			iamv0.SchemeGroupVersion.WithResource(resource), "", admission.Create, nil, false, nil)
		return b.Validate(ctx, attrs, nil)
	}
	newUser := func(login, email string) *iamv0.User {
		return &iamv0.User{
			ObjectMeta: metav1.ObjectMeta{Name: "new-user", Namespace: "default"},
			Spec:       iamv0.UserSpec{Login: login, Email: email, Role: "Viewer"},
		}
	}
	newTeam := func(title string) *iamv0.Team {
		return &iamv0.Team{
			ObjectMeta: metav1.ObjectMeta{Name: "new-team", Namespace: "default"},
			Spec:       iamv0.TeamSpec{Title: title},
		}
	}

	t.Run("accepts a new user", func(t *testing.T) {
		require.NoError(t, validateCreate(newUser("fresh", "fresh@example.com"), "users", "new-user"))
	})
	t.Run("rejects a duplicate login", func(t *testing.T) {
		err := validateCreate(newUser("taken", "other@example.com"), "users", "new-user")
		require.True(t, apierrors.IsConflict(err), "got %v", err)
	})
	t.Run("rejects a duplicate email", func(t *testing.T) {
		err := validateCreate(newUser("other", "taken@example.com"), "users", "new-user")
		require.True(t, apierrors.IsConflict(err), "got %v", err)
	})
	t.Run("rejects a user without login or email", func(t *testing.T) {
		err := validateCreate(newUser("", ""), "users", "new-user")
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})
	t.Run("accepts a new team", func(t *testing.T) {
		require.NoError(t, validateCreate(newTeam("Fresh Team"), "teams", "new-team"))
	})
	t.Run("rejects a duplicate team title regardless of case", func(t *testing.T) {
		err := validateCreate(newTeam("taken team"), "teams", "new-team")
		require.True(t, apierrors.IsConflict(err), "got %v", err)
	})
	t.Run("rejects a team without title", func(t *testing.T) {
		err := validateCreate(newTeam(""), "teams", "new-team")
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})
}
