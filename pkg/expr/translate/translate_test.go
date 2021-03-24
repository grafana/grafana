package translate

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr/classic"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestDashboardAlertConditions(t *testing.T) {
	registerGetDsInfoHandler()
	var tests = []struct {
		name string
		// inputJSONFName, at least for now, is as "conditions" will appear within the alert table
		// settings column JSON. Which means it has already run through the dashboard
		// alerting Extractor. It is the input.
		inputJSONFName string

		// Condition is quite large (and unexported things), so check misc attributes.
		spotCheckFn func(t *testing.T, cond *ngmodels.Condition)
	}{
		{
			name:           "two conditions one query but different time ranges",
			inputJSONFName: `sameQueryDifferentTimeRange.json`,
			spotCheckFn: func(t *testing.T, cond *ngmodels.Condition) {
				require.Equal(t, "C", cond.Condition, "unexpected refId for condition")
				require.Equal(t, 3, len(cond.Data), "unexpected query/expression array length")

				firstQuery := cond.Data[0]
				require.Equal(t, "A", firstQuery.RefID, "unexpected refId for first query")
				require.Equal(t, ngmodels.RelativeTimeRange{
					From: ngmodels.Duration(time.Second * 600),
					To:   ngmodels.Duration(time.Second * 300),
				}, firstQuery.RelativeTimeRange, "unexpected timerange for first query")

				secondQuery := cond.Data[1]
				require.Equal(t, "B", secondQuery.RefID, "unexpected refId for second query")
				require.Equal(t, ngmodels.RelativeTimeRange{
					From: ngmodels.Duration(time.Second * 300),
					To:   ngmodels.Duration(0),
				}, secondQuery.RelativeTimeRange, "unexpected timerange for second query")

				condQuery := cond.Data[2]
				require.Equal(t, "C", condQuery.RefID, "unexpected refId for second query")
				isExpr, err := condQuery.IsExpression()
				require.NoError(t, err)
				require.Equal(t, true, isExpr, "third query should be an expression")

				c := struct {
					Conditions []classic.ClassicConditionJSON `json:"conditions"`
				}{}
				err = json.Unmarshal(condQuery.Model, &c)
				require.NoError(t, err)

				require.Equal(t, 2, len(c.Conditions), "expected 2 conditions in classic condition")

				// This is "correct" in that the condition gets the correct time range,
				// but a bit odd that it creates B then A, can look into changing that
				// later.
				firstCond := c.Conditions[0]
				require.Equal(t, "lt", firstCond.Evaluator.Type, "expected first cond to use lt")
				require.Equal(t, "B", firstCond.Query.Params[0], "expected first cond to reference B")

				secondCond := c.Conditions[1]
				require.Equal(t, "gt", secondCond.Evaluator.Type, "expected second cond to use gt")
				require.Equal(t, "A", secondCond.Query.Params[0], "expected second cond to reference A")
			},
		},
		{
			name:           "mixed shared and unshared time ranges",
			inputJSONFName: `mixedSharedUnsharedTimeRange.json`,
			spotCheckFn: func(t *testing.T, cond *ngmodels.Condition) {
				require.Equal(t, "G", cond.Condition, "unexpected refId for condition")
				require.Equal(t, 7, len(cond.Data), "unexpected query/expression array length")

				condQuery := cond.Data[6]
				isExpr, err := condQuery.IsExpression()
				require.NoError(t, err)
				require.Equal(t, true, isExpr, "expected last query to be an expression")

				c := struct {
					Conditions []classic.ClassicConditionJSON `json:"conditions"`
				}{}
				err = json.Unmarshal(condQuery.Model, &c)
				require.NoError(t, err)

				require.Equal(t, 8, len(c.Conditions), "expected 8 conditions in classic condition")

				firstCond := c.Conditions[0]
				require.Equal(t, "gt", firstCond.Evaluator.Type, "expected first cond to use gt")
				require.Equal(t, "avg", firstCond.Reducer.Type, "expected first cond to use reducer avg")
				firstCondRefID := firstCond.Query.Params[0]

				aq, err := alertRuleByRefId(cond, firstCondRefID)
				require.NoError(t, err)
				require.Equal(t, ngmodels.Duration(300*time.Second), aq.RelativeTimeRange.From,
					"expected first condition to reference a query with a from of 300 seconds")
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonFile := filepath.Join("testdata", tt.inputJSONFName)
			//nolint:GOSEC
			b, err := ioutil.ReadFile(jsonFile)

			require.NoError(t, err)

			cond, err := DashboardAlertConditions(b, 1)
			require.NoError(t, err)

			tt.spotCheckFn(t, cond)
		})
	}
}

func alertRuleByRefId(cond *ngmodels.Condition, refID string) (ngmodels.AlertQuery, error) {
	for _, aq := range cond.Data {
		if aq.RefID == refID {
			return aq, nil
		}
	}
	return ngmodels.AlertQuery{}, fmt.Errorf("query with refId %v not found", refID)
}

func registerGetDsInfoHandler() {
	bus.AddHandler("test", func(query *models.GetDataSourceQuery) error {
		switch {
		case query.Id == 2:
			query.Result = &models.DataSource{Id: 2, OrgId: 1, Uid: "000000002"}
		case query.Id == 4:
			query.Result = &models.DataSource{Id: 4, OrgId: 1, Uid: "000000004"}
		default:
			return fmt.Errorf("datasource not found")
		}
		return nil
	})
}
