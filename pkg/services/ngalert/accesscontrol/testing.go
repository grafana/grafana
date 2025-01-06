package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ accesscontrol.AccessControl = &recordingAccessControlFake{}

type recordingAccessControlFake struct {
	accesscontrol.AccessControl
	Disabled           bool
	EvaluateRecordings []struct {
		Permissions map[string][]string
		Evaluator   accesscontrol.Evaluator
	}
	Callback func(user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error)
}

func (a *recordingAccessControlFake) Evaluate(_ context.Context, ur identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	a.EvaluateRecordings = append(a.EvaluateRecordings, struct {
		Permissions map[string][]string
		Evaluator   accesscontrol.Evaluator
	}{Permissions: ur.GetPermissions(), Evaluator: evaluator})
	if a.Callback == nil {
		return evaluator.Evaluate(ur.GetPermissions()), nil
	}
	return a.Callback(ur, evaluator)
}
