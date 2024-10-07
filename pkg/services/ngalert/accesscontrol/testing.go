package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

func (a *recordingAccessControlFake) WithoutResolvers() accesscontrol.AccessControl {
	panic("unimplemented")
}

func (a *recordingAccessControlFake) Check(ctx context.Context, in accesscontrol.CheckRequest) (bool, error) {
	return false, nil
}

func (a *recordingAccessControlFake) ListObjects(ctx context.Context, in accesscontrol.ListObjectsRequest) ([]string, error) {
	return nil, nil
}

var _ accesscontrol.AccessControl = &recordingAccessControlFake{}
