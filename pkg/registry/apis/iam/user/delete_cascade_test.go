package user

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

const testNamespace = "default"

type fakeUserStorage struct {
	storewrapper.K8sStorage
	calls *[]string
	err   error
}

func (f *fakeUserStorage) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	*f.calls = append(*f.calls, "user:"+name)
	if f.err != nil {
		return nil, false, f.err
	}
	return &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: name}}, true, nil
}

type fakeAuthInfoStorage struct {
	rest.Lister
	calls     *[]string
	items     []iamv0.AuthInfo
	listErr   error
	deleteErr map[string]error

	listSelector string
	isService    bool
}

func (f *fakeAuthInfoStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listSelector = options.FieldSelector.String()
	f.isService = identity.IsServiceIdentity(ctx)
	if f.listErr != nil {
		return nil, f.listErr
	}
	return &iamv0.AuthInfoList{Items: f.items}, nil
}

func (f *fakeAuthInfoStorage) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	*f.calls = append(*f.calls, "authinfo:"+name)
	if err := f.deleteErr[name]; err != nil {
		return nil, false, err
	}
	return nil, true, nil
}

func authInfo(name string) iamv0.AuthInfo {
	return iamv0.AuthInfo{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: testNamespace}}
}

func TestCascadeDeleter_Delete(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), testNamespace)
	notFound := apierrors.NewNotFound(iamv0.AuthInfoResourceInfo.GroupResource(), "ldap-1")

	t.Run("deletes the user's auth infos before the user", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, items: []iamv0.AuthInfo{authInfo("ldap-1"), authInfo("oauth-1")}}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos, nil, nil)

		_, deleted, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.True(t, deleted)
		assert.Equal(t, []string{"authinfo:ldap-1", "authinfo:oauth-1", "user:u1"}, calls)
		assert.Equal(t, "spec.userRef.name=u1", authInfos.listSelector)
		assert.True(t, authInfos.isService, "cascade must not depend on the caller's AuthInfo permissions")
	})

	t.Run("ignores auth infos that are already gone", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{
			calls:     &calls,
			items:     []iamv0.AuthInfo{authInfo("ldap-1")},
			deleteErr: map[string]error{"ldap-1": notFound},
		}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"authinfo:ldap-1", "user:u1"}, calls)
	})

	t.Run("keeps the user when an auth info delete fails", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{
			calls:     &calls,
			items:     []iamv0.AuthInfo{authInfo("ldap-1")},
			deleteErr: map[string]error{"ldap-1": errors.New("boom")},
		}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Equal(t, []string{"authinfo:ldap-1"}, calls)
	})

	t.Run("keeps the user when listing auth infos fails", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, listErr: errors.New("boom")}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Empty(t, calls)
	})

	t.Run("skips the cascade on dry run", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, items: []iamv0.AuthInfo{authInfo("ldap-1")}}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}})

		require.NoError(t, err)
		assert.Equal(t, []string{"user:u1"}, calls)
	})

	t.Run("passes through without auth info storage", func(t *testing.T) {
		var calls []string
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, nil, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"user:u1"}, calls)
	})

	t.Run("returns the user delete error", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls, err: notFound}, authInfos, nil, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.True(t, apierrors.IsNotFound(err))
	})
}

type fakeModeReader struct{}

func (fakeModeReader) ReadFromUnified(context.Context, schema.GroupResource) (bool, error) {
	return true, nil
}

type fakeCascadeTeamsBackend struct {
	pages   [][]string
	err     error
	queries []UserTeamsQuery
	isSvc   bool
}

func (f *fakeCascadeTeamsBackend) ListUserTeams(ctx context.Context, q UserTeamsQuery) (*UserTeamsPage, error) {
	f.queries = append(f.queries, q)
	f.isSvc = identity.IsServiceIdentity(ctx)
	if f.err != nil {
		return nil, f.err
	}
	idx := len(f.queries) - 1
	page := &UserTeamsPage{}
	for _, name := range f.pages[idx] {
		page.Items = append(page.Items, iamv0.GetUserTeamsUserTeam{Team: name})
	}
	if idx < len(f.pages)-1 {
		page.Next = []string{"cursor"}
	}
	return page, nil
}

type fakeTeamStorage struct {
	teams     map[string]*iamv0.Team
	calls     *[]string
	updateErr map[string]error
	conflicts map[string]int
	isSvc     bool
}

func (f *fakeTeamStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	f.isSvc = identity.IsServiceIdentity(ctx)
	t, ok := f.teams[name]
	if !ok {
		return nil, apierrors.NewNotFound(iamv0.TeamResourceInfo.GroupResource(), name)
	}
	return t.DeepCopy(), nil
}

func (f *fakeTeamStorage) Update(_ context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if f.conflicts[name] > 0 {
		f.conflicts[name]--
		return nil, false, apierrors.NewConflict(iamv0.TeamResourceInfo.GroupResource(), name, errors.New("rv"))
	}
	if err := f.updateErr[name]; err != nil {
		return nil, false, err
	}
	obj, err := objInfo.UpdatedObject(context.Background(), f.teams[name])
	if err != nil {
		return nil, false, err
	}
	f.teams[name] = obj.(*iamv0.Team)
	*f.calls = append(*f.calls, "team:"+name)
	return obj, false, nil
}

func cascadeTeam(name string, members ...string) *iamv0.Team {
	t := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: testNamespace}}
	for _, m := range members {
		t.Spec.Members = append(t.Spec.Members, iamv0.TeamTeamMember{Kind: "User", Name: m})
	}
	return t
}

func memberNames(t *iamv0.Team) []string {
	out := make([]string, 0, len(t.Spec.Members))
	for _, m := range t.Spec.Members {
		out = append(out, m.Name)
	}
	return out
}

func TestCascadeDeleter_Delete_TeamMemberships(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), testNamespace)

	setup := func(backend *fakeCascadeTeamsBackend, teams *fakeTeamStorage, calls *[]string) *CascadeDeleter {
		selector := dualwrite.NewSelector[UserTeamsBackend](fakeModeReader{}, iamv0.TeamResourceInfo.GroupResource(), backend, backend)
		return NewCascadeDeleter(&fakeUserStorage{calls: calls}, nil, teams, selector)
	}

	t.Run("removes the user from every team across pages before deleting the user", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{pages: [][]string{{"t1", "t2"}, {"t3"}}}
		teams := &fakeTeamStorage{calls: &calls, teams: map[string]*iamv0.Team{
			"t1": cascadeTeam("t1", "u1", "u2"),
			"t2": cascadeTeam("t2", "u1"),
			"t3": cascadeTeam("t3", "u3", "u1"),
		}}

		_, deleted, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.True(t, deleted)
		assert.Equal(t, []string{"team:t1", "team:t2", "team:t3", "user:u1"}, calls)
		assert.Equal(t, []string{"u2"}, memberNames(teams.teams["t1"]))
		assert.Empty(t, teams.teams["t2"].Spec.Members)
		assert.Equal(t, []string{"u3"}, memberNames(teams.teams["t3"]))
		require.Len(t, backend.queries, 2)
		assert.Equal(t, []string{"cursor"}, backend.queries[1].After)
		assert.Equal(t, "u1", backend.queries[0].UserUID)
		assert.True(t, backend.isSvc, "cascade must not depend on the caller's Team permissions")
		assert.True(t, teams.isSvc)
	})

	t.Run("skips teams that no longer list the user or are gone", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{pages: [][]string{{"t1", "gone", "stale"}}}
		teams := &fakeTeamStorage{calls: &calls, teams: map[string]*iamv0.Team{
			"t1":    cascadeTeam("t1", "u1"),
			"stale": cascadeTeam("stale", "u2"),
		}}

		_, _, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"team:t1", "user:u1"}, calls)
	})

	t.Run("retries on conflict", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{pages: [][]string{{"t1"}}}
		teams := &fakeTeamStorage{calls: &calls, conflicts: map[string]int{"t1": 2}, teams: map[string]*iamv0.Team{"t1": cascadeTeam("t1", "u1")}}

		_, _, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"team:t1", "user:u1"}, calls)
	})

	t.Run("keeps the user when a team update fails", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{pages: [][]string{{"t1"}}}
		teams := &fakeTeamStorage{calls: &calls, updateErr: map[string]error{"t1": errors.New("boom")}, teams: map[string]*iamv0.Team{"t1": cascadeTeam("t1", "u1")}}

		_, _, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Empty(t, calls)
	})

	t.Run("keeps the user when listing teams fails", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{err: errors.New("boom")}
		teams := &fakeTeamStorage{calls: &calls}

		_, _, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Empty(t, calls)
	})

	t.Run("skips the cascade on dry run", func(t *testing.T) {
		var calls []string
		backend := &fakeCascadeTeamsBackend{pages: [][]string{{"t1"}}}
		teams := &fakeTeamStorage{calls: &calls, teams: map[string]*iamv0.Team{"t1": cascadeTeam("t1", "u1")}}

		_, _, err := setup(backend, teams, &calls).Delete(ctx, "u1", nil, &metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}})

		require.NoError(t, err)
		assert.Equal(t, []string{"user:u1"}, calls)
		assert.Empty(t, backend.queries)
	})
}

func (f *fakeTeamStorage) New() runtime.Object { return &iamv0.Team{} }
