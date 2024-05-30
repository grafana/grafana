package eval

import (
	"context"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/auth/identity"
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
}

func NewContext(ctx context.Context, user identity.Requester) EvaluationContext {
	return EvaluationContext{
		Ctx:  ctx,
		User: user,
	}
}

func NewContextWithPreviousResults(ctx context.Context, user identity.Requester, reader AlertingResultsReader) EvaluationContext {
	return EvaluationContext{
		Ctx:                   ctx,
		User:                  user,
		AlertingResultsReader: reader,
	}
}
