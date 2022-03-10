package api

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/stretchr/testify/require"
)

func TestRouteGetAlertStatuses(t *testing.T) {
	fakeStore := store.NewFakeRuleStore(t)
	fakeAlertInstanceManager := NewFakeAlertInstanceManager(t)
	orgID := int64(1)

	server := PrometheusSrv{
		log:     log.NewNopLogger(),
		manager: fakeAlertInstanceManager,
		store:   fakeStore,
	}

	c := &models.ReqContext{SignedInUser: &models.SignedInUser{OrgId: orgID}}

	t.Run("with no alerts", func(t *testing.T) {
		r := server.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": []
	}
}
`, string(r.Body()))
	})

	t.Run("with two alerts", func(t *testing.T) {
		fakeAlertInstanceManager.GenerateAlertInstances(1, 2)
		r := server.RouteGetAlertStatuses(c)
		require.Equal(t, http.StatusOK, r.Status())
		require.JSONEq(t, `
{
	"status": "success",
	"data": {
		"alerts": [{
			"labels": {
				"__alert_rule_namespace_uid__": "test_namespace_uid",
				"__alert_rule_uid__": "test_alert_rule_uid_0",
				"alertname": "test_title_0",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}, {
			"labels": {
				"__alert_rule_namespace_uid__": "test_namespace_uid",
				"__alert_rule_uid__": "test_alert_rule_uid_1",
				"alertname": "test_title_1",
				"instance_label": "test",
				"label": "test"
			},
			"annotations": {
				"annotation": "test"
			},
			"state": "Normal",
			"activeAt": "0001-01-01T00:00:00Z",
			"value": ""
		}]
	}
}`, string(r.Body()))
	})
}
