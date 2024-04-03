package eval

import (
	"context"
	"net/http" // LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models" // LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts
)

// AlertingResultsReader provides fingerprints of results that are in alerting state.
// It is used during the evaluation of queries.
type AlertingResultsReader interface {
	Read() map[data.Fingerprint]struct{}
}

// EvaluationContext represents the context in which a condition is evaluated.
type EvaluationContext struct {
	Ctx                   context.Context
	User                  identity.Requester
	AlertingResultsReader AlertingResultsReader
	LogzioEvalContext     *models.LogzioAlertRuleEvalContext // LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts
}

func NewContext(ctx context.Context, user identity.Requester) EvaluationContext {
	// LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts
	logzioEvalContext := &models.LogzioAlertRuleEvalContext{
		LogzioHeaders:     http.Header{},
		DsOverrideByDsUid: map[string]models.EvaluationDatasourceOverride{},
	}
	// LOGZ.IO GRAFANA CHANGE :: end

	return EvaluationContext{
		Ctx:               ctx,
		User:              user,
		LogzioEvalContext: logzioEvalContext, // LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts
	}
}

// LOGZ.IO GRAFANA CHANGE :: DEV-43744 - Pass headers and custom datasource to evaluate alerts
func NewContextWithPreviousResults(ctx context.Context, user identity.Requester, reader AlertingResultsReader, logzioEvalContext *models.LogzioAlertRuleEvalContext) EvaluationContext {
	if logzioEvalContext == nil {
		logzioEvalContext = &models.LogzioAlertRuleEvalContext{
			LogzioHeaders:     http.Header{},
			DsOverrideByDsUid: map[string]models.EvaluationDatasourceOverride{},
		}
	}

	return EvaluationContext{
		Ctx:                   ctx,
		User:                  user,
		AlertingResultsReader: reader,
		LogzioEvalContext:     logzioEvalContext,
	}
}

// LOGZ.IO GRAFANA CHANGE :: end
