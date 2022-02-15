package api

import (
	"context"
	"encoding/json"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

func randomDbAlertRule(orgID int64) *models.AlertRule {
	randNoDataState := func() models.NoDataState {
		s := [...]models.NoDataState{
			models.Alerting,
			models.NoData,
			models.OK,
		}
		return s[rand.Intn(len(s)-1)]
	}

	randErrState := func() models.ExecutionErrorState {
		s := [...]models.ExecutionErrorState{
			models.AlertingErrState,
			models.ErrorErrState,
			models.OkErrState,
		}
		return s[rand.Intn(len(s)-1)]
	}

	interval := (rand.Int63n(6) + 1) * 10
	forInterval := time.Duration(interval*rand.Int63n(6)) * time.Second

	var annotations map[string]string = nil
	if rand.Int63()%2 == 0 {
		qty := rand.Intn(5)
		annotations = make(map[string]string, qty)
		for i := 0; i < qty; i++ {
			annotations[util.GenerateShortUID()] = util.GenerateShortUID()
		}
	}
	var labels map[string]string = nil
	if rand.Int63()%2 == 0 {
		qty := rand.Intn(5)
		labels = make(map[string]string, qty)
		for i := 0; i < qty; i++ {
			labels[util.GenerateShortUID()] = util.GenerateShortUID()
		}
	}

	var dashUID *string = nil
	var panelID *int64 = nil
	if rand.Int63()%2 == 0 {
		d := util.GenerateShortUID()
		dashUID = &d
		p := rand.Int63()
		panelID = &p
	}

	return &models.AlertRule{
		ID:        rand.Int63(),
		OrgID:     orgID,
		Title:     "TEST-ALERT-" + util.GenerateShortUID(),
		Condition: "A",
		Data: []models.AlertQuery{
			{
				DatasourceUID: "-100",
				Model: json.RawMessage(`{
			"datasourceUid": "-100",
			"type":"math",
			"expression":"2 + 1 < 1"
		}`),
				RelativeTimeRange: models.RelativeTimeRange{
					From: models.Duration(5 * time.Hour),
					To:   models.Duration(3 * time.Hour),
				},
				RefID: "A",
			}},
		Updated:         time.Now().Add(-time.Duration(rand.Intn(100) + 1)),
		IntervalSeconds: rand.Int63n(60) + 1,
		Version:         rand.Int63(),
		UID:             util.GenerateShortUID(),
		NamespaceUID:    util.GenerateShortUID(),
		DashboardUID:    dashUID,
		PanelID:         panelID,
		RuleGroup:       "TEST-GROUP-" + util.GenerateShortUID(),
		NoDataState:     randNoDataState(),
		ExecErrState:    randErrState(),
		For:             forInterval,
		Annotations:     annotations,
		Labels:          labels,
	}
}

func randomSubmittedAlertRule(orgID int64) *models.AlertRule {
	r := randomDbAlertRule(orgID)
	r.ID = 0
	return r
}

func randomAlertRules(orgID int64, count int, f func(orgID int64) *models.AlertRule) (map[string]*models.AlertRule, []*models.AlertRule) {
	uIDs := make(map[string]*models.AlertRule, count)
	result := make([]*models.AlertRule, 0, count)
	for len(result) < count {
		rule := f(orgID)
		if _, ok := uIDs[rule.UID]; ok {
			continue
		}
		result = append(result, rule)
		uIDs[rule.UID] = rule
	}
	return uIDs, result
}

func TestCalculateChanges(t *testing.T) {
	orgId := rand.Int63()

	t.Run("should detect alerts that need to be added", func(t *testing.T) {
		fakeStore := store.NewFakeRuleStore(t)

		namespace := randFolder()
		groupName := util.GenerateShortUID()
		submittedMap, submitted := randomAlertRules(orgId, rand.Intn(5)+1, randomSubmittedAlertRule)

		changes, err := calculateChanges(context.Background(), fakeStore, orgId, namespace, groupName, submitted)
		require.NoError(t, err)

		require.Equal(t, changes.newRules, len(submitted))
		require.Empty(t, changes.Delete)
		require.Len(t, changes.Upsert, len(submitted))
		for _, rule := range changes.Upsert {
			require.Nil(t, rule.Existing)
			expected, ok := submittedMap[rule.New.UID]
			require.Truef(t, ok, "The upsert contained a rule that was not submitted")
			require.Equal(t, *expected, rule.New)
		}
	})

	// should add those that do not exist in db
	// should delete those that exist in db but not in request
	// should update those that exist in db (same group)
	// should update those that exist but in different group
}
