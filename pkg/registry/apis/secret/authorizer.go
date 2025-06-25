package secret

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

type wrapAuthorizer struct {
	authorizer      authorizer.Authorizer
	auditLogService contracts.AuditLogService
}

func (w *wrapAuthorizer) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	defer func() {
		actionStatus := contracts.AuditLogActionStatusOK
		if err != nil {
			actionStatus = contracts.AuditLogActionStatusError
		} else if decision == authorizer.DecisionDeny {
			actionStatus = contracts.AuditLogActionStatusUnauthorized
		}

		w.auditLogService.Observe(ctx, contracts.AuditLogEntry{
			Namespace:          xkube.Namespace(a.GetNamespace()),
			ObservedAt:         time.Now(),
			ActorUID:           a.GetUser().GetUID(),
			Action:             contracts.AuditLogActionType(a.GetVerb()),
			TargetResourceKind: a.GetResource(),
			TargetResourceName: a.GetName(),
			ActionStatus:       actionStatus,
		})
	}()

	return w.authorizer.Authorize(ctx, a)
}
