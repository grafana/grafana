package snapshot

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// NewSnapshotAuthorizer returns an authorizer that maps k8s verbs to snapshot RBAC actions.
// The snapshots resource is gated on kubernetesSnapshots, evaluated per request: the storage
// is always registered, so enablement is enforced here. When the feature is disabled, snapshots
// are served exclusively by the legacy /api routes and the /apis endpoints are denied.
// When enabled, anonymous GET requests for snapshots and the dashboard subresource are allowed
// without RBAC checks (mirroring legacy SnapshotPublicMode behavior).
func NewSnapshotAuthorizer(accessControl ac.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagKubernetesSnapshots, false, openfeature.TransactionContext(ctx)) {
				return authorizer.DecisionDeny, "kubernetes snapshots feature is not enabled", nil
			}

			// Allow anonymous GET on snapshots and the dashboard subresource (public viewing).
			verb := attr.GetVerb()
			sub := attr.GetSubresource()
			if verb == "get" && (sub == "" || sub == "dashboard") {
				return authorizer.DecisionAllow, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// Custom routes: snapshots/create, snapshots/delete/{deleteKey}, snapshots/settings
			// K8s parses these as name="create"|"delete"|"settings" with the path param as subresource.
			name := attr.GetName()
			if name == "create" || name == "delete" || name == "settings" {
				var action string
				switch name {
				case "create":
					action = dashboards.ActionSnapshotsCreate
				case "delete":
					action = dashboards.ActionSnapshotsDelete
				case "settings":
					action = dashboards.ActionSnapshotsRead
				}
				ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "access denied", err
				}
				return authorizer.DecisionAllow, "", nil
			}

			// Handle subresources
			if attr.GetSubresource() != "" {
				var action string
				switch attr.GetSubresource() {
				case "dashboard":
					action = dashboards.ActionSnapshotsRead
				case "deletekey":
					action = dashboards.ActionSnapshotsDelete
				case "delete":
					action = dashboards.ActionSnapshotsDelete
				case "create":
					action = dashboards.ActionSnapshotsCreate
				case "settings":
					action = dashboards.ActionSnapshotsRead
				default:
					return authorizer.DecisionDeny, "unsupported subresource", nil
				}
				ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "access denied", err
				}
				return authorizer.DecisionAllow, "", nil
			}

			// Map k8s verbs to snapshot RBAC actions
			var action string
			switch attr.GetVerb() {
			case "get", "list":
				action = dashboards.ActionSnapshotsRead
			case "create":
				action = dashboards.ActionSnapshotsCreate
			case "delete":
				action = dashboards.ActionSnapshotsDelete
			default:
				return authorizer.DecisionDeny, "unsupported verb", nil
			}

			ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
			if !ok || err != nil {
				return authorizer.DecisionDeny, "access denied", err
			}
			return authorizer.DecisionAllow, "", nil
		})
}
