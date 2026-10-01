package pluginaccesscontrol

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// TestGetDataSourceRouteEvaluator_ServiceIdentityReachesAlertmanagerConfigRoute guards a
// regression where a background job using identity.WithServiceIdentity to proxy a GET through
// the Alertmanager datasource plugin (e.g. ExternalAMSyncer fetching api/v1/alerts) was denied:
// that route requires alert.notifications.external:read scoped to the datasource, which the
// shared service-identity permission set didn't grant.
func TestGetDataSourceRouteEvaluator_ServiceIdentityReachesAlertmanagerConfigRoute(t *testing.T) {
	_, requester := identity.WithServiceIdentity(context.Background(), 1)

	evaluator := GetDataSourceRouteEvaluator("some-ds-uid", ac.ActionAlertingNotificationsExternalRead)
	assert.True(t, evaluator.Evaluate(requester.GetPermissions()),
		"service identity must satisfy the Alertmanager plugin's api/v1/alerts route RBAC check")
}
