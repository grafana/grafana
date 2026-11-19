package team

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

type fakeTeamStore struct {
	team      *iamv0alpha1.Team
	updateErr error
	// beforeUpdate simulates a concurrent writer landing between Get and Update.
	beforeUpdate func(*iamv0alpha1.Team)
	updates      int
}

func (f *fakeTeamStore) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	return f.team.DeepCopy(), nil
}

func (f *fakeTeamStore) Update(ctx context.Context, _ string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if f.updateErr != nil {
		return nil, false, f.updateErr
	}
	if f.beforeUpdate != nil {
		f.beforeUpdate(f.team)
	}
	obj, err := objInfo.UpdatedObject(ctx, f.team)
	if err != nil {
		return nil, false, err
	}
	f.team = obj.(*iamv0alpha1.Team)
	f.updates++
	return obj, false, nil
}

func TestRemoveUserMember(t *testing.T) {
	newTeam := func() *iamv0alpha1.Team {
		return &iamv0alpha1.Team{Spec: iamv0alpha1.TeamSpec{Members: []iamv0alpha1.TeamTeamMember{
			{Kind: "User", Name: "u1"}, {Kind: "User", Name: "u2"},
		}}}
	}

	t.Run("removes only the given user", func(t *testing.T) {
		store := &fakeTeamStore{team: newTeam()}
		removed, err := RemoveUserMember(context.Background(), store, store, "t1", "u1")
		require.NoError(t, err)
		assert.True(t, removed)
		require.Len(t, store.team.Spec.Members, 1)
		assert.Equal(t, "u2", store.team.Spec.Members[0].Name)
	})

	t.Run("keeps members changed concurrently between read and write", func(t *testing.T) {
		store := &fakeTeamStore{team: newTeam()}
		store.team.ResourceVersion = "1"
		store.beforeUpdate = func(live *iamv0alpha1.Team) {
			live.ResourceVersion = "2"
			live.Spec.Members = append(live.Spec.Members, iamv0alpha1.TeamTeamMember{Kind: "User", Name: "u3"})
		}
		removed, err := RemoveUserMember(context.Background(), store, store, "t1", "u1")
		require.NoError(t, err)
		assert.True(t, removed)
		assert.Equal(t, "2", store.team.ResourceVersion, "write must carry the resourceVersion Update read")
		require.Len(t, store.team.Spec.Members, 2)
		assert.Equal(t, "u2", store.team.Spec.Members[0].Name)
		assert.Equal(t, "u3", store.team.Spec.Members[1].Name)
	})

	t.Run("is a no-op for a non-member", func(t *testing.T) {
		store := &fakeTeamStore{team: newTeam()}
		removed, err := RemoveUserMember(context.Background(), store, store, "t1", "nobody")
		require.NoError(t, err)
		assert.False(t, removed)
		assert.Zero(t, store.updates)
	})

	t.Run("converts transient SQL errors to conflicts", func(t *testing.T) {
		store := &fakeTeamStore{team: newTeam(), updateErr: errors.New("Error 1213: deadlock")}
		_, err := RemoveUserMember(context.Background(), store, store, "t1", "u1")
		require.Error(t, err)
		assert.True(t, apierrors.IsConflict(err))
	})
}

func (f *fakeTeamStore) New() runtime.Object { return &iamv0alpha1.Team{} }
