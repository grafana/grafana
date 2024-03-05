package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type recordingAccessControlFake struct {
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

func (a *recordingAccessControlFake) RegisterScopeAttributeResolver(prefix string, resolver accesscontrol.ScopeAttributeResolver) {
	// TODO implement me
	panic("implement me")
}

func (a *recordingAccessControlFake) IsDisabled() bool {
	return a.Disabled
}

var _ accesscontrol.AccessControl = &recordingAccessControlFake{}
