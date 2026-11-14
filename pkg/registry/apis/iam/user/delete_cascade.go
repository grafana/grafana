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
	"k8s.io/client-go/util/retry"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/team"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

const authInfoUserRefField = "spec.userRef.name"

type AuthInfoStorage interface {
	rest.Lister
	rest.GracefulDeleter
}

// TeamStorage is the Team storage used to remove a user from the teams they belong to.
type TeamStorage interface {
	rest.Getter
	rest.Updater
}

var _ storewrapper.K8sStorage = (*CascadeDeleter)(nil)

// CascadeDeleter removes resources owned by a user before the user itself is deleted.
// Cleanup runs first so that, once the user is gone, nothing is left that can only be
// found by resolving the user, and a failed cleanup leaves the user in place for a retry.
type CascadeDeleter struct {
	storewrapper.K8sStorage
	authInfos AuthInfoStorage
	teams     TeamStorage
	userTeams *dualwrite.Selector[UserTeamsBackend]
}

func NewCascadeDeleter(inner storewrapper.K8sStorage, authInfos AuthInfoStorage, teams TeamStorage, userTeams *dualwrite.Selector[UserTeamsBackend]) *CascadeDeleter {
	return &CascadeDeleter{K8sStorage: inner, authInfos: authInfos, teams: teams, userTeams: userTeams}
}

func (c *CascadeDeleter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	if options == nil || !dryrun.IsDryRun(options.DryRun) {
		if err := c.deleteAuthInfos(ctx, name); err != nil {
			return nil, false, err
		}
		if err := c.removeTeamMemberships(ctx, name); err != nil {
			return nil, false, err
		}
	}
	return c.K8sStorage.Delete(ctx, name, deleteValidation, options)
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

func (c *CascadeDeleter) removeTeamMemberships(ctx context.Context, userUID string) error {
	if c.teams == nil || c.userTeams == nil {
		return nil
	}

	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return apierrors.NewBadRequest("namespace is required")
	}
	// The caller is already authorized to delete the user; it may not hold Team write permissions.
	svcCtx := identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)

	backend, err := c.userTeams.Resolve(svcCtx)
	if err != nil {
		return fmt.Errorf("failed to resolve user teams backend: %w", err)
	}

	// Collect every team first.
	var teamNames []string
	var after []string
	for {
		page, err := backend.ListUserTeams(svcCtx, UserTeamsQuery{
			Namespace: namespace,
			UserUID:   userUID,
			Limit:     common.DefaultListLimit,
			After:     after,
		})
		if err != nil {
			return fmt.Errorf("failed to list teams for user %s: %w", userUID, err)
		}
		for _, item := range page.Items {
			if item.Team != "" {
				teamNames = append(teamNames, item.Team)
			}
		}
		if len(page.Next) == 0 {
			break
		}
		after = page.Next
	}

	for _, teamName := range teamNames {
		err := retry.RetryOnConflict(retry.DefaultRetry, func() error {
			_, err := team.RemoveUserMember(svcCtx, c.teams, c.teams, teamName, userUID)
			return err
		})
		if err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("failed to remove user %s from team %s: %w", userUID, teamName, err)
		}
	}
	return nil
}
