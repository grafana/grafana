package team

import (
	"context"
	"fmt"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// RemoveUserMember removes a user from Spec.Members of the named team. It
// reports whether the user was a member.
func RemoveUserMember(ctx context.Context, getter rest.Getter, updater rest.Updater, teamName, userUID string) (bool, error) {
	obj, err := getter.Get(ctx, teamName, &metav1.GetOptions{})
	if err != nil {
		return false, err
	}
	t, ok := obj.(*iamv0alpha1.Team)
	if !ok {
		return false, apierrors.NewInternalError(fmt.Errorf("team store returned unexpected type %T", obj))
	}
	if !slices.ContainsFunc(t.Spec.Members, func(m iamv0alpha1.TeamTeamMember) bool { return isUserMember(m, userUID) }) {
		return false, nil
	}

	removed := false
	// Edit the object Update reads, not the snapshot above: legacy storage diffs
	// the written members against live rows, so a stale snapshot would revert
	// concurrent membership changes.
	dropUser := func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
		oldTeam, ok := oldObj.(*iamv0alpha1.Team)
		if !ok {
			return nil, apierrors.NewInternalError(fmt.Errorf("team store returned unexpected type %T", oldObj))
		}
		updated := oldTeam.DeepCopy()
		before := len(updated.Spec.Members)
		updated.Spec.Members = slices.DeleteFunc(updated.Spec.Members, func(m iamv0alpha1.TeamTeamMember) bool { return isUserMember(m, userUID) })
		removed = len(updated.Spec.Members) < before
		return updated, nil
	}
	// 409 surfaces unchanged; SQL deadlocks (which arrive as 500
	// from unified storage) are converted so RetryOnConflict catches them.
	if _, _, err := updater.Update(ctx, teamName, rest.DefaultUpdatedObjectInfo(nil, dropUser),
		nil, nil, false, &metav1.UpdateOptions{}); err != nil {
		if isRetryableTxnError(err) {
			return false, apierrors.NewConflict(teamResource.GroupResource(), teamName, err)
		}
		return false, err
	}
	return removed, nil
}

func isUserMember(m iamv0alpha1.TeamTeamMember, userUID string) bool {
	return m.Kind == "User" && m.Name == userUID
}
