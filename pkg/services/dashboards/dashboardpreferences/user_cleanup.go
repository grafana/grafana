package dashboardpreferences

import (
	"context"
	"errors"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

const userCleanupTimeout = 5 * time.Second

var (
	logger = log.New("dashboardpreferences.cleanup")

	errNamespaceMissing    = errors.New("namespace is missing")
	errRemovalNotCommitted = errors.New("the user's removal has not been committed yet")
)

// UserCleaner deletes a user's user-tier DashboardPreferences object.
type UserCleaner interface {
	// DeleteUserPreferences deletes user-<userUID> in namespace as Grafana's service identity.
	// A missing object is not an error. A server that doesn't serve dashboardpreferences returns an
	// error that wraps ErrNotServed.
	DeleteUserPreferences(ctx context.Context, namespace, userUID string) error
}

type userCleaner struct {
	restConfig func(ctx context.Context, namespace string) (*rest.Config, error)
}

// NewUserCleaner returns a UserCleaner whose client is built on each call, from restConfig for the
// namespace it deletes in.
func NewUserCleaner(restConfig func(ctx context.Context, namespace string) (*rest.Config, error)) UserCleaner {
	return &userCleaner{restConfig: restConfig}
}

// ProvideUserCleaner is the Wire provider: the loopback config of Grafana's API server.
func ProvideUserCleaner(restConfig apiserver.RestConfigProvider) UserCleaner {
	return NewUserCleaner(func(ctx context.Context, _ string) (*rest.Config, error) {
		return restConfig.GetRestConfig(ctx)
	})
}

func (c *userCleaner) DeleteUserPreferences(ctx context.Context, namespace, userUID string) error {
	if userUID == "" {
		return nil
	}
	name := dashv2beta1.DashboardPreferencesUserName(userUID)
	if len(validation.IsValidGrafanaName(name)) > 0 {
		return nil
	}
	if err := validateNamespace(namespace); err != nil {
		return err
	}

	// The user has already left, so the cleanup outlives the caller. The bound keeps a login that
	// removes the user from an org from waiting on an API server that isn't up.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), userCleanupTimeout)
	defer cancel()
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)

	cfg, err := c.restConfig(ctx, namespace)
	if err != nil {
		return fmt.Errorf("get rest config: %w", err)
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return fmt.Errorf("create dynamic client: %w", err)
	}

	return deleteByName(ctx, client.Resource(dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource()), namespace, name, metav1.DeleteOptions{})
}

// UserLeftNamespace deletes user-<userUID> in namespace. A failure is logged at Warn, never returned.
// A nil cleaner or an empty userUID does nothing.
func UserLeftNamespace(ctx context.Context, cleaner UserCleaner, namespace, userUID string) {
	if cleaner == nil || userUID == "" {
		return
	}
	if namespace == "" {
		WarnNotDeleted(ctx, namespace, userUID, errNamespaceMissing)
		return
	}
	if err := cleaner.DeleteUserPreferences(ctx, namespace, userUID); err != nil {
		WarnNotDeleted(ctx, namespace, userUID, err)
	}
}

// UserLeftOrgs calls UserLeftNamespace for the namespace of each org in leftOrgIDs, once per namespace,
// unless an org in remainingOrgIDs has that namespace too. A nil cleaner or an empty userUID does nothing.
func UserLeftOrgs(ctx context.Context, cleaner UserCleaner, cfg *setting.Cfg, userUID string, leftOrgIDs, remainingOrgIDs []int64) {
	if cleaner == nil || userUID == "" {
		return
	}
	toNamespace := request.GetNamespaceMapper(cfg)
	skip := make(map[string]bool, len(remainingOrgIDs)+len(leftOrgIDs))
	for _, orgID := range remainingOrgIDs {
		skip[toNamespace(orgID)] = true
	}

	// The removal isn't committed until the outer transaction is, and on SQLite the loopback delete
	// would wait on that open write transaction.
	inTransaction := sqlstore.IsInTransaction(ctx)
	for _, orgID := range leftOrgIDs {
		namespace := toNamespace(orgID)
		if skip[namespace] {
			continue
		}
		skip[namespace] = true
		if inTransaction {
			WarnNotDeleted(ctx, namespace, userUID, errRemovalNotCommitted)
			continue
		}
		UserLeftNamespace(ctx, cleaner, namespace, userUID)
	}
}

// WarnNotDeleted logs that user-<userUID> may remain in namespace, which is empty when the miss came
// before the namespace was known. Every hook logs its misses through it, so that each miss is one
// message with one set of keys.
func WarnNotDeleted(ctx context.Context, namespace, userUID string, err error) {
	logger.FromContext(ctx).Warn("Failed to delete a user's dashboard preferences", "namespace", namespace, "userUID", userUID, "error", err)
}
