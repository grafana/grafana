package provisioning

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func TestAlertRuleService(t *testing.T) {
	ruleService := createAlertRuleService(t)
	t.Run("alert rule group should be updated on creation", func(t *testing.T) {
		var orgID int64 = 1
		rule := models.AlertRule{
			OrgID:           orgID,
			Title:           "my-title",
			Condition:       "some cond",
			Version:         1,
			IntervalSeconds: 60,
			Data: []models.AlertQuery{
				{
					RefID: "A",
					Model: json.RawMessage("{}"),
					RelativeTimeRange: models.RelativeTimeRange{
						From: models.Duration(60),
						To:   models.Duration(0),
					},
				},
			},
			RuleGroup:    "my-cool-group",
			For:          time.Second * 60,
			NoDataState:  models.OK,
			ExecErrState: models.OkErrState,
		}
		err := ruleService.CreateAlertRule(context.Background(), rule, models.ProvenanceNone)
		require.NoError(t, err)
	})
	t.Run("alert rule group should be updated on update", func(t *testing.T) {

	})
	t.Run("alert rule provenace should be correctly checked", func(t *testing.T) {
		tests := []struct {
			name   string
			from   models.Provenance
			to     models.Provenance
			errNil bool
		}{
			{
				name:   "should be able to update from provenance none to api",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceAPI,
				errNil: true,
			},
			{
				name:   "should be able to update from provenance none to file",
				from:   models.ProvenanceNone,
				to:     models.ProvenanceFile,
				errNil: true,
			},
			{
				name:   "should not be able to update from provenance api to file",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceFile,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance api to none",
				from:   models.ProvenanceAPI,
				to:     models.ProvenanceNone,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to api",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceAPI,
				errNil: false,
			},
			{
				name:   "should not be able to update from provenance file to none",
				from:   models.ProvenanceFile,
				to:     models.ProvenanceNone,
				errNil: false,
			},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {

			})
		}
	})
}

func createAlertRuleService(t *testing.T) AlertRuleService {
	t.Helper()
	sqlStore := sqlstore.InitTestDB(t)
	store := store.DBstore{
		SQLStore:     sqlStore,
		BaseInterval: time.Second * 10,
	}
	return AlertRuleService{
		ruleStore:       store,
		provenanceStore: store,
		xact:            sqlStore,
		log:             log.New("testing"),
	}
}
