package team

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// RemoveUserMember filters a user out of Spec.Members of the named team and
// writes the team back through updater. It reports whether the user was a member.
func RemoveUserMember(ctx context.Context, getter rest.Getter, updater rest.Updater, teamName, userUID string) (bool, error) {
	obj, err := getter.Get(ctx, teamName, &metav1.GetOptions{})
	if err != nil {
		return false, err
	}
	t, ok := obj.(*iamv0alpha1.Team)
	if !ok {
		return false, apierrors.NewInternalError(fmt.Errorf("team store returned unexpected type %T", obj))
	}
	removeIdx := -1
	for i, m := range t.Spec.Members {
		if m.Kind == "User" && m.Name == userUID {
			removeIdx = i
			break
		}
	}
	if removeIdx < 0 {
		return false, nil
	}
	t.Spec.Members = append(t.Spec.Members[:removeIdx], t.Spec.Members[removeIdx+1:]...)
	// 409 surfaces unchanged; SQL deadlocks (which arrive as 500
	// from unified storage) are converted so RetryOnConflict catches them.
	if _, _, err := updater.Update(ctx, teamName, rest.DefaultUpdatedObjectInfo(t),
		nil, nil, false, &metav1.UpdateOptions{}); err != nil {
		if isRetryableTxnError(err) {
			return false, apierrors.NewConflict(teamResource.GroupResource(), teamName, err)
		}
		return false, err
	}
	return true, nil
}
