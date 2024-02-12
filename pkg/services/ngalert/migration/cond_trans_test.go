package migration

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestCondTransMultiCondOnSingleQuery(t *testing.T) {
	// Here we are testing that we got a query that is referenced by multiple conditions, all conditions get set correctly.
	ordID := int64(1)

	settings := dashAlertSettings{}

	cond1 := dashAlertCondition{}
	cond1.Evaluator.Params = []float64{20}
	cond1.Evaluator.Type = "lt"
	cond1.Operator.Type = "and"
	cond1.Query.DatasourceID = 4
	cond1.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"000000004"},"intervalMs":2000,"maxDataPoints":1500,"refId":"F","target":"my_metrics"}`)
	cond1.Query.Params = []string{
		"F",
		"75m",
		"now-15m",
	}
	cond1.Reducer.Type = "avg"

	cond2 := dashAlertCondition{}
	cond2.Evaluator.Params = []float64{500}
	cond2.Evaluator.Type = "gt"
	cond2.Operator.Type = "or"
	cond2.Query.DatasourceID = 4
	cond1.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"000000004"},"intervalMs":2000,"maxDataPoints":1500,"refId":"F","target":"my_metrics"}`)
	cond2.Query.Params = []string{
		"F",
		"75m",
		"now-15m",
	}
	cond2.Reducer.Type = "avg"

	settings.Conditions = []dashAlertCondition{cond1, cond2}

	alertQuery1 := models.AlertQuery{
		RefID:         "A",
		DatasourceUID: expr.DatasourceUID,
		Model:         []byte(`{"type":"classic_conditions","refId":"A","conditions":[{"evaluator":{"params":[20],"type":"lt"},"operator":{"type":"and"},"query":{"params":["F"]},"reducer":{"type":"avg"}},{"evaluator":{"params":[500],"type":"gt"},"operator":{"type":"or"},"query":{"params":["F"]},"reducer":{"type":"avg"}}]}`),
	}
	alertQuery2 := models.AlertQuery{
		RefID: "F",
		RelativeTimeRange: models.RelativeTimeRange{
			From: 4500000000000,
			To:   900000000000,
		},
		Model: cond1.Query.Model,
	}
	expected := &condition{
		Condition: "A",
		OrgID:     ordID,
		Data:      []models.AlertQuery{alertQuery1, alertQuery2},
	}

	migrationStore := store.NewTestMigrationStore(t, db.InitTestDB(t), &setting.Cfg{})
	c, err := transConditions(context.Background(), &logtest.Fake{}, settings, ordID, migrationStore)

	require.NoError(t, err)
	require.Equal(t, expected, c)
}

func TestCondTransExtended(t *testing.T) {
	// Here we are testing that we got a query that is referenced with multiple different offsets, the migration
	// generated correctly all subqueries for each offset. RefID A exists twice with a different offset (cond1, cond4).
	ordID := int64(1)

	settings := dashAlertSettings{}

	cond1 := dashAlertCondition{}
	cond1.Evaluator.Params = []float64{-500000}
	cond1.Evaluator.Type = "lt"
	cond1.Operator.Type = "and"
	cond1.Query.DatasourceID = 4
	cond1.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"1"},"hide":false,"intervalMs":15000,"maxDataPoints":1500,"refCount":0,"refId":"A","target":"my_metric_1","textEditor":true}`)
	cond1.Query.Params = []string{
		"A",
		"1h",
		"now",
	}
	cond1.Reducer.Type = "diff"

	cond2 := dashAlertCondition{}
	cond2.Evaluator.Params = []float64{
		-0.01,
		0.01,
	}
	cond2.Evaluator.Type = "within_range"
	cond2.Operator.Type = "or"
	cond2.Query.DatasourceID = 4
	cond2.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"1"},"hide":true,"intervalMs":15000,"maxDataPoints":1500,"refCount":0,"refId":"B","target":"my_metric_2","textEditor":false}`)
	cond2.Query.Params = []string{
		"B",
		"6h",
		"now",
	}
	cond2.Reducer.Type = "diff"

	cond3 := dashAlertCondition{}
	cond3.Evaluator.Params = []float64{
		-500000,
	}
	cond3.Evaluator.Type = "lt"
	cond3.Operator.Type = "or"
	cond3.Query.DatasourceID = 4
	cond3.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"1"},"hide":false,"intervalMs":15000,"maxDataPoints":1500,"refCount":0,"refId":"C","target":"my_metric_3","textEditor":false}`)
	cond3.Query.Params = []string{
		"C",
		"1m",
		"now",
	}
	cond3.Reducer.Type = "diff"

	cond4 := dashAlertCondition{}
	cond4.Evaluator.Params = []float64{
		1000000,
	}
	cond4.Evaluator.Type = "gt"
	cond4.Operator.Type = "and"
	cond4.Query.DatasourceID = 4
	cond4.Query.Model = []byte(`{"datasource":{"type":"graphite","uid":"1"},"hide":false,"intervalMs":15000,"maxDataPoints":1500,"refCount":0,"refId":"A","target":"my_metric_1","textEditor":true}`)
	cond4.Query.Params = []string{
		"A",
		"5m",
		"now",
	}
	cond4.Reducer.Type = "last"

	settings.Conditions = []dashAlertCondition{cond1, cond2, cond3, cond4}

	alertQuery1 := models.AlertQuery{
		RefID: "A",
		RelativeTimeRange: models.RelativeTimeRange{
			From: 3600000000000,
		},
		Model: cond1.Query.Model,
	}
	alertQuery2 := models.AlertQuery{
		RefID: "B",
		RelativeTimeRange: models.RelativeTimeRange{
			From: 300000000000,
		},
		Model: []byte(strings.ReplaceAll(string(cond1.Query.Model), "refId\":\"A", "refId\":\"B")),
	}
	alertQuery3 := models.AlertQuery{
		RefID: "C",
		RelativeTimeRange: models.RelativeTimeRange{
			From: 21600000000000,
		},
		Model: []byte(strings.ReplaceAll(string(cond2.Query.Model), "refId\":\"B", "refId\":\"C")),
	}
	alertQuery4 := models.AlertQuery{
		RefID: "D",
		RelativeTimeRange: models.RelativeTimeRange{
			From: 60000000000,
		},
		Model: []byte(strings.ReplaceAll(string(cond3.Query.Model), "refId\":\"C", "refId\":\"D")),
	}
	alertQuery5 := models.AlertQuery{
		RefID:         "E",
		DatasourceUID: "__expr__",
		Model:         []byte(`{"type":"classic_conditions","refId":"E","conditions":[{"evaluator":{"params":[-500000],"type":"lt"},"operator":{"type":"and"},"query":{"params":["A"]},"reducer":{"type":"diff"}},{"evaluator":{"params":[-0.01,0.01],"type":"within_range"},"operator":{"type":"or"},"query":{"params":["C"]},"reducer":{"type":"diff"}},{"evaluator":{"params":[-500000],"type":"lt"},"operator":{"type":"or"},"query":{"params":["D"]},"reducer":{"type":"diff"}},{"evaluator":{"params":[1000000],"type":"gt"},"operator":{"type":"and"},"query":{"params":["B"]},"reducer":{"type":"last"}}]}`),
	}

	expected := &condition{
		Condition: "E",
		OrgID:     ordID,
		Data:      []models.AlertQuery{alertQuery1, alertQuery2, alertQuery3, alertQuery4, alertQuery5},
	}

	migrationStore := store.NewTestMigrationStore(t, db.InitTestDB(t), &setting.Cfg{})
	c, err := transConditions(context.Background(), &logtest.Fake{}, settings, ordID, migrationStore)

	require.NoError(t, err)
	require.Equal(t, expected, c)
}
