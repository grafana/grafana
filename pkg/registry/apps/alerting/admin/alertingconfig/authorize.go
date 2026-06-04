package alertingconfig

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Authorize gates k8s API verbs on AlertingConfig. Placeholder: permits all
// requests on the resource for now; a follow-up commit replaces this with
// RBAC action checks (alert.admin-config:read for reads, :write for writes).
func Authorize(ctx context.Context, ac accesscontrol.AccessControl, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
	if attr.GetResource() != ResourceInfo.GroupResource().Resource {
		return authorizer.DecisionNoOpinion, "", nil
	}
	return authorizer.DecisionAllow, "", nil
}
