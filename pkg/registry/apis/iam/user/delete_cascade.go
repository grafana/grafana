package user

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/util/dryrun"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardpreferences"
)

const authInfoUserRefField = "spec.userRef.name"

type AuthInfoStorage interface {
	rest.Lister
	rest.GracefulDeleter
}

var _ storewrapper.K8sStorage = (*CascadeDeleter)(nil)

// CascadeDeleter removes resources owned by a user when the user is deleted.
// Owned AuthInfos are removed first, so that once the user is gone nothing is left that can
// only be found by resolving the user, and a failed AuthInfo cleanup fails the delete and
// leaves the user in place for a retry. The user's dashboard preferences are removed after
// the user, best effort.
type CascadeDeleter struct {
	storewrapper.K8sStorage
	authInfos   AuthInfoStorage
	preferences dashboardpreferences.UserCleaner
}

func NewCascadeDeleter(inner storewrapper.K8sStorage, authInfos AuthInfoStorage, preferences dashboardpreferences.UserCleaner) *CascadeDeleter {
	return &CascadeDeleter{K8sStorage: inner, authInfos: authInfos, preferences: preferences}
}

func (c *CascadeDeleter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	dryRun := options != nil && dryrun.IsDryRun(options.DryRun)
	if !dryRun {
		if err := c.deleteAuthInfos(ctx, name); err != nil {
			return nil, false, err
		}
	}
	obj, deleted, err := c.K8sStorage.Delete(ctx, name, deleteValidation, options)
	if err == nil && !dryRun {
		c.deletePreferences(ctx, name)
	}
	return obj, deleted, err
}

func (c *CascadeDeleter) Watch(ctx context.Context, options *internalversion.ListOptions) (watch.Interface, error) {
	watcher, ok := c.K8sStorage.(rest.Watcher)
	if !ok {
		return nil, fmt.Errorf("watch is not supported on the underlying storage")
	}
	return watcher.Watch(ctx, options)
}

func (c *CascadeDeleter) deleteAuthInfos(ctx context.Context, userUID string) error {
	if c.authInfos == nil {
		return nil
	}

	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return apierrors.NewBadRequest("namespace is required")
	}
	// The caller is already authorized to delete the user; it may not hold AuthInfo permissions.
	svcCtx := identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)

	obj, err := c.authInfos.List(svcCtx, &internalversion.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(authInfoUserRefField, userUID),
	})
	if err != nil {
		return fmt.Errorf("failed to list auth infos for user %s: %w", userUID, err)
	}
	return meta.EachListItem(obj, func(item runtime.Object) error {
		accessor, err := meta.Accessor(item)
		if err != nil {
			return err
		}
		name := accessor.GetName()
		if _, _, err := c.authInfos.Delete(svcCtx, name, nil, &metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("failed to delete auth info %s for user %s: %w", name, userUID, err)
		}
		return nil
	})
}

// Unlike a leftover AuthInfo, a leftover preferences object is named by a UID no other user
// gets, so a failure here doesn't fail the user's delete. It runs after the user so that a
// failed user delete keeps the user's preferences.
func (c *CascadeDeleter) deletePreferences(ctx context.Context, userUID string) {
	if c.preferences == nil {
		return
	}
	namespace, _ := request.NamespaceFrom(ctx)
	dashboardpreferences.UserLeftNamespace(ctx, c.preferences, namespace, userUID)
}
