package flagsmith

import (
	"context"

	of "github.com/open-feature/go-sdk/pkg/openfeature"
)

type FlagsmithOfClient struct {
	evalCtx  of.EvaluationContext
	ofClient *of.Client
}

func (foc *FlagsmithOfClient) IsEnabled(feature string) (bool, error) {
	return foc.ofClient.BooleanValue(context.Background(), feature, false, foc.evalCtx)
}
