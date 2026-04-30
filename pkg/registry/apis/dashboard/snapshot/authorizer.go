package snapshot

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// NewSnapshotAuthorizer returns an authorizer that maps k8s verbs to snapshot RBAC actions.
func NewSnapshotAuthorizer(accessClient authlib.AccessClient) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			authInfo, ok := authlib.AuthInfoFrom(ctx)
			if !ok {
				return authorizer.DecisionDeny, "valid user is required", fmt.Errorf("auth info missing from context")
			}

			verb := attr.GetVerb()

			// map subresources to their equivalent verbs
			if sr := attr.GetSubresource(); sr != "" {
				switch sr {
				case "dashboard":
					verb = utils.VerbGet
				case "deletekey":
					verb = utils.VerbDelete
				default:
					return authorizer.DecisionDeny, "unsupported subresource", nil
				}
			} else {
				// normalize list/watch to get — they all require read access
				switch verb {
				case "list", "watch":
					verb = utils.VerbGet
				}
			}

			res, err := accessClient.Check(ctx, authInfo, authlib.CheckRequest{
				Namespace: attr.GetNamespace(),
				Verb:      verb,
				Group:     dashv0.GROUP,
				Resource:  dashv0.SNAPSHOT_RESOURCE,
				Name:      attr.GetName(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "access check failed", err
			}
			if !res.Allowed {
				return authorizer.DecisionDeny, "access denied", nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}
