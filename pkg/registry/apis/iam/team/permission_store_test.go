package team

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestPermissionStore_Writes(t *testing.T) {
	for _, tc := range []struct {
		name      string
		create    bool
		canWrite  bool
		mutate    func(*iamv0.Team)
		forbidden bool
	}{
		{name: "create without members", create: true, mutate: func(obj *iamv0.Team) { obj.Spec.Members = nil; obj.Spec.ExternalGroups = nil }},
		{name: "create with members denied", create: true, forbidden: true},
		{name: "create with members allowed", create: true, canWrite: true},
		{name: "rename allowed without membership permission", mutate: func(obj *iamv0.Team) { obj.Spec.Title = "renamed" }},
		{name: "remove members denied", mutate: func(obj *iamv0.Team) { obj.Spec.Members = nil }, forbidden: true},
		{name: "add member denied", mutate: func(obj *iamv0.Team) {
			obj.Spec.Members = append(obj.Spec.Members, iamv0.TeamTeamMember{Kind: "User", Name: "new-user", Permission: "member"})
		}, forbidden: true},
		{name: "promote member denied", mutate: func(obj *iamv0.Team) { obj.Spec.Members[0].Permission = "admin" }, forbidden: true},
		{name: "change external origin denied", mutate: func(obj *iamv0.Team) { obj.Spec.Members[0].External = true }, forbidden: true},
		{name: "change external groups denied", mutate: func(obj *iamv0.Team) { obj.Spec.ExternalGroups = []string{"other-group"} }, forbidden: true},
		{name: "remove members allowed", canWrite: true, mutate: func(obj *iamv0.Team) { obj.Spec.Members = nil }},
		{name: "reorder members allowed", mutate: func(obj *iamv0.Team) {
			obj.Spec.Members[0], obj.Spec.Members[1] = obj.Spec.Members[1], obj.Spec.Members[0]
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			inner := &permissionStoreFake{object: permissionTestTeam()}
			client := &membershipAccessClient{check: func(req types.CheckRequest) (types.CheckResponse, error) {
				require.Equal(t, "iam.grafana.app", req.Group)
				require.Equal(t, "teams", req.Resource)
				require.Equal(t, "stacks-13", req.Namespace)
				require.Equal(t, "team-1", req.Name)
				require.Contains(t, []string{utils.VerbGetPermissions, utils.VerbSetPermissions}, req.Verb)
				return types.CheckResponse{Allowed: tc.canWrite && req.Verb == utils.VerbSetPermissions}, nil
			}}
			storage, err := NewPermissionStore(inner, client)
			require.NoError(t, err)
			obj := inner.object.DeepCopy()
			if tc.mutate != nil {
				tc.mutate(obj)
			}
			var result runtime.Object
			if tc.create {
				result, err = storage.(rest.Creater).Create(permissionTestContext(t), obj, nil, nil)
			} else {
				result, _, err = storage.(rest.Updater).Update(permissionTestContext(t), obj.Name, rest.DefaultUpdatedObjectInfo(obj), nil, nil, false, nil)
			}
			if tc.forbidden {
				require.True(t, apierrors.IsForbidden(err), "got %v", err)
				require.False(t, inner.written)
			} else {
				require.NoError(t, err)
				require.True(t, inner.written)
				require.Empty(t, result.(*iamv0.Team).Spec.Members, "write responses must not leak membership")
				require.Empty(t, result.(*iamv0.Team).Spec.ExternalGroups)
				require.Equal(t, obj.Spec, inner.saved.Spec, "redaction must not change persisted data")
			}
		})
	}
}

func TestPermissionStore_Reads(t *testing.T) {
	for _, operation := range []string{"get", "list", "watch", "delete"} {
		for _, allowed := range []bool{false, true} {
			t.Run(operation+"/"+map[bool]string{false: "denied", true: "allowed"}[allowed], func(t *testing.T) {
				inner := &permissionStoreFake{object: permissionTestTeam(), watcher: watch.NewRaceFreeFake()}
				client := &membershipAccessClient{check: func(req types.CheckRequest) (types.CheckResponse, error) {
					require.Equal(t, utils.VerbGetPermissions, req.Verb)
					return types.CheckResponse{Allowed: allowed}, nil
				}}
				storage, err := NewPermissionStore(inner, client)
				require.NoError(t, err)
				ctx := permissionTestContext(t)
				var result runtime.Object
				switch operation {
				case "get":
					result, err = storage.(rest.Getter).Get(ctx, "team-1", nil)
				case "list":
					var list runtime.Object
					list, err = storage.(rest.Lister).List(ctx, nil)
					require.NoError(t, err)
					require.Len(t, list.(*iamv0.TeamList).Items, 1)
					result = &list.(*iamv0.TeamList).Items[0]
				case "watch":
					var stream watch.Interface
					stream, err = storage.(rest.Watcher).Watch(ctx, nil)
					require.NoError(t, err)
					defer stream.Stop()
					inner.watcher.Add(inner.object)
					result = (<-stream.ResultChan()).Object
				case "delete":
					result, _, err = storage.(rest.GracefulDeleter).Delete(ctx, "team-1", nil, &metav1.DeleteOptions{})
				}
				require.NoError(t, err)
				obj := result.(*iamv0.Team)
				require.Equal(t, "team", obj.Spec.Title)
				if allowed {
					require.Equal(t, inner.object.Spec, obj.Spec)
				} else {
					require.Empty(t, obj.Spec.Members)
					require.Empty(t, obj.Spec.ExternalGroups)
				}
				require.Len(t, inner.object.Spec.Members, 2, "do not mutate shared storage objects")
				require.NotEmpty(t, inner.object.Spec.ExternalGroups)
			})
		}
	}
}

func TestPermissionStore_AccessErrors(t *testing.T) {
	failure := errors.New("permission service unavailable")
	inner := &permissionStoreFake{object: permissionTestTeam(), watcher: watch.NewRaceFreeFake()}
	storage, err := NewPermissionStore(inner, &membershipAccessClient{check: func(types.CheckRequest) (types.CheckResponse, error) { return types.CheckResponse{}, failure }})
	require.NoError(t, err)
	ctx := permissionTestContext(t)
	_, err = storage.(rest.Getter).Get(ctx, "team-1", nil)
	require.ErrorIs(t, err, failure)
	_, err = storage.(rest.Lister).List(ctx, nil)
	require.ErrorIs(t, err, failure)
	_, err = storage.(rest.Creater).Create(ctx, inner.object.DeepCopy(), nil, nil)
	require.ErrorIs(t, err, failure)
	require.False(t, inner.written)
	updated := inner.object.DeepCopy()
	updated.Spec.Members = nil
	_, _, err = storage.(rest.Updater).Update(ctx, updated.Name, rest.DefaultUpdatedObjectInfo(updated), nil, nil, false, nil)
	require.ErrorIs(t, err, failure)
	require.False(t, inner.written)
	_, err = storage.(rest.Getter).Get(context.Background(), "team-1", nil)
	require.True(t, apierrors.IsUnauthorized(err))
	stream, err := storage.(rest.Watcher).Watch(ctx, nil)
	require.NoError(t, err)
	defer stream.Stop()
	inner.watcher.Modify(inner.object)
	event := <-stream.ResultChan()
	require.Equal(t, watch.Error, event.Type)
	_, open := <-stream.ResultChan()
	require.False(t, open)
}

func permissionTestContext(t *testing.T) context.Context {
	return identity.WithRequester(t.Context(), &identity.StaticRequester{Type: types.TypeUser, UserUID: "user-1", Namespace: "stacks-13"})
}
func permissionTestTeam() *iamv0.Team {
	return &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "team-1", Namespace: "stacks-13"}, Spec: iamv0.TeamSpec{
		Title: "team", ExternalGroups: []string{"group"}, Members: []iamv0.TeamTeamMember{
			{Kind: "User", Name: "user-1", Permission: "member"},
			{Kind: "User", Name: "user-2", Permission: "admin"},
		},
	}}
}

type membershipAccessClient struct {
	types.AccessClient
	check      func(types.CheckRequest) (types.CheckResponse, error)
	batchCheck func(types.BatchCheckRequest) (types.BatchCheckResponse, error)
}

func (c *membershipAccessClient) Check(_ context.Context, _ types.AuthInfo, req types.CheckRequest, _ string) (types.CheckResponse, error) {
	return c.check(req)
}

type permissionStoreFake struct {
	grafanarest.Storage
	object  *iamv0.Team
	saved   *iamv0.Team
	written bool
	watcher *watch.RaceFreeFakeWatcher
}

func (s *permissionStoreFake) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	return s.object, nil
}
func (s *permissionStoreFake) List(context.Context, *internalversion.ListOptions) (runtime.Object, error) {
	return &iamv0.TeamList{Items: []iamv0.Team{*s.object}}, nil
}
func (s *permissionStoreFake) Create(_ context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	s.written = true
	s.saved = obj.(*iamv0.Team)
	return obj, nil
}
func (s *permissionStoreFake) Update(ctx context.Context, _ string, info rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	obj, err := info.UpdatedObject(ctx, s.object.DeepCopy())
	if err != nil {
		return nil, false, err
	}
	s.written = true
	s.saved = obj.(*iamv0.Team)
	return obj, false, nil
}
func (s *permissionStoreFake) Watch(context.Context, *internalversion.ListOptions) (watch.Interface, error) {
	return s.watcher, nil
}
func (s *permissionStoreFake) Delete(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return s.object, true, nil
}

func (c *membershipAccessClient) BatchCheck(_ context.Context, _ types.AuthInfo, req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
	if c.batchCheck != nil {
		return c.batchCheck(req)
	}
	results := make(map[string]types.BatchCheckResult, len(req.Checks))
	for _, check := range req.Checks {
		result, err := c.check(types.CheckRequest{Group: check.Group, Resource: check.Resource, Namespace: req.Namespace, Name: check.Name, Verb: check.Verb})
		if err != nil {
			return types.BatchCheckResponse{}, err
		}
		results[check.CorrelationID] = types.BatchCheckResult{Allowed: result.Allowed}
	}
	return types.BatchCheckResponse{Results: results}, nil
}

func TestMembershipPermissions_BatchRedaction(t *testing.T) {
	for _, operation := range []string{"list", "watch"} {
		t.Run(operation, func(t *testing.T) {
			count := types.MaxBatchCheckItems + 1
			list := &iamv0.TeamList{}
			events := make([]watch.Event, count)
			for i := 0; i < count; i++ {
				obj := permissionTestTeam()
				obj.Name = "team-" + strconv.Itoa(i)
				list.Items = append(list.Items, *obj)
				events[i] = watch.Event{Type: watch.Modified, Object: obj}
			}
			calls := 0
			permissions := &membershipPermissions{accessClient: &membershipAccessClient{
				batchCheck: func(req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
					calls++
					require.Equal(t, "stacks-13", req.Namespace)
					require.LessOrEqual(t, len(req.Checks), types.MaxBatchCheckItems)
					results := make(map[string]types.BatchCheckResult)
					for _, check := range req.Checks {
						require.Equal(t, "iam.grafana.app", check.Group)
						require.Equal(t, "teams", check.Resource)
						require.Equal(t, utils.VerbGetPermissions, check.Verb)
						require.Equal(t, "team-"+check.CorrelationID, check.Name)
						i, err := strconv.Atoi(check.CorrelationID)
						require.NoError(t, err)
						if i%2 == 0 {
							results[check.CorrelationID] = types.BatchCheckResult{Allowed: true}
						}
					}
					return types.BatchCheckResponse{Results: results}, nil
				},
			}}
			var result []*iamv0.Team
			if operation == "list" {
				obj, err := permissions.FilterList(permissionTestContext(t), list)
				require.NoError(t, err)
				for i := range obj.(*iamv0.TeamList).Items {
					result = append(result, &obj.(*iamv0.TeamList).Items[i])
				}
			} else {
				filter, err := permissions.WatchFilter(permissionTestContext(t))
				require.NoError(t, err)
				allowed, err := filter(events)
				require.NoError(t, err)
				require.Len(t, allowed, count)
				for i := range events {
					require.True(t, allowed[i], "membership redaction must not hide the team")
					result = append(result, events[i].Object.(*iamv0.Team))
				}
			}
			require.Equal(t, 2, calls)
			for i, obj := range result {
				if i%2 == 0 {
					require.NotEmpty(t, obj.Spec.Members)
					require.NotEmpty(t, obj.Spec.ExternalGroups)
				} else {
					require.Empty(t, obj.Spec.Members, "missing authorization results must redact")
					require.Empty(t, obj.Spec.ExternalGroups)
				}
				require.NotEmpty(t, list.Items[i].Spec.Members, "do not mutate the original object")
			}
		})
	}
}
