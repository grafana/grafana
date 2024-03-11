package extractor

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func init() {
	RegisterCondition("query", func(model *simplejson.Json, index int) (Condition, error) {
		return newQueryCondition(model, index)
	})
}

// ConditionFactory is the function signature for creating `Conditions`.
type ConditionFactory func(model *simplejson.Json, index int) (Condition, error)

var conditionFactories = make(map[string]ConditionFactory)

// RegisterCondition adds support for alerting conditions.
func RegisterCondition(typeName string, factory ConditionFactory) {
	conditionFactories[typeName] = factory
}

type ConditionResultStub struct{}

// Condition is a stub interface for alert conditions.
type Condition interface {
	Eval(evalCtxStub *EvalContextStub, requestHandler legacydata.RequestHandler) (*ConditionResultStub, error)
}

// EvalContextStub is the context object for an alert evaluation.
type EvalContextStub struct {
	// Firing         bool
	// IsTestRun      bool
	// IsDebug        bool
	// EvalMatches    []*EvalMatch
	// AllMatches     []*EvalMatch
	// Logs           []*ResultLogEntry
	// Error          error
	// ConditionEvals string
	// StartTime      time.Time
	// EndTime        time.Time
	// Rule           *Rule
	// Log            log.Logger

	// dashboardRef *dashboards.DashboardRef

	// ImagePublicURL  string
	// ImageOnDiskPath string
	// NoDataFound     bool
	// PrevAlertState  alertmodels.AlertStateType

	// RequestValidator validations.PluginRequestValidator

	// Ctx context.Context

	// Store             AlertStore
	// dashboardService  dashboards.DashboardService
	// DatasourceService datasources.DataSourceService
	// annotationRepo    annotations.Repository
}

// QueryCondition is responsible for issue and query, reduce the
// timeseries into single values and evaluate if they are firing or not.
type QueryCondition struct {
	Index     int
	Query     AlertQuery
	Reducer   *queryReducer
	Evaluator AlertEvaluator
	Operator  string
}

// AlertQuery contains information about what datasource a query
// should be sent to and the query object.
type AlertQuery struct {
	Model        *simplejson.Json
	DatasourceID int64
	From         string
	To           string
}

// AlertEvaluator evaluates the reduced value of a timeseries.
// Returning true if a timeseries is violating the condition
// ex: ThresholdEvaluator, NoValueEvaluator, RangeEvaluator
type AlertEvaluator interface {
	Eval(reducedValue null.Float) bool
}

func newQueryCondition(model *simplejson.Json, index int) (*QueryCondition, error) {
	condition := QueryCondition{}
	condition.Index = index

	queryJSON := model.Get("query")

	condition.Query.Model = queryJSON.Get("model")
	condition.Query.From = queryJSON.Get("params").MustArray()[1].(string)
	condition.Query.To = queryJSON.Get("params").MustArray()[2].(string)

	if err := validateFromValue(condition.Query.From); err != nil {
		return nil, err
	}

	if err := validateToValue(condition.Query.To); err != nil {
		return nil, err
	}

	condition.Query.DatasourceID = queryJSON.Get("datasourceId").MustInt64()

	reducerJSON := model.Get("reducer")
	condition.Reducer = newSimpleReducer(reducerJSON.Get("type").MustString())

	evaluatorJSON := model.Get("evaluator")
	evaluator, err := NewAlertEvaluator(evaluatorJSON)
	if err != nil {
		return nil, fmt.Errorf("error in condition %v: %v", index, err)
	}
	condition.Evaluator = evaluator

	operatorJSON := model.Get("operator")
	operator := operatorJSON.Get("type").MustString("and")
	condition.Operator = operator

	return &condition, nil
}

func (q *QueryCondition) Eval(evalCtxStub *EvalContextStub, requestHandler legacydata.RequestHandler) (*ConditionResultStub, error) {
	return nil, nil // stub
}

// TODO: move to utils

func validateFromValue(from string) error {
	fromRaw := strings.Replace(from, "now-", "", 1)

	_, err := time.ParseDuration("-" + fromRaw)
	return err
}

func validateToValue(to string) error {
	if to == "now" {
		return nil
	} else if strings.HasPrefix(to, "now-") {
		withoutNow := strings.Replace(to, "now-", "", 1)

		_, err := time.ParseDuration("-" + withoutNow)
		if err == nil {
			return nil
		}
	}

	_, err := time.ParseDuration(to)
	return err
}
