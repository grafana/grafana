package authz

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
)

// patAccessClient fails closed for personal access tokens. The wrapped RBAC client
// authorizes with the owner's stored permissions, so the token's own limits are
// applied here as an intersection: a request is only forwarded when the token's
// effective permissions hold the matching action, and tokens narrowed to specific
// resources are always denied because that narrowing cannot be evaluated here.
// Resources without a mapped action are denied for every token.
type patAccessClient struct {
	authlib.AccessClient
}

func withPersonalTokenGuard(c authlib.AccessClient) authlib.AccessClient {
	return &patAccessClient{AccessClient: c}
}

func isPersonalToken(info authlib.AuthInfo) bool {
	by, ok := info.(interface{ GetAuthenticatedBy() string })
	return ok && by.GetAuthenticatedBy() == login.PersonalTokenAuthModule
}

// tokenGrants returns the token's effective limits. Identities carrying them
// directly are used as is; for ID-token based identities they are looked up by
// the signed token, and a missing entry means the limits are unknown.
func tokenGrants(info authlib.AuthInfo) (patscope.Grants, bool) {
	if p, ok := info.(interface{ GetPermissions() map[string][]string }); ok {
		scoped, _ := info.(interface{ IsPersonalTokenResourceScoped() bool })
		return patscope.Grants{Permissions: p.GetPermissions(), ResourceScoped: scoped != nil && scoped.IsPersonalTokenResourceScoped()}, true
	}
	return patscope.LookupGrants(info.GetIDToken())
}

// patActionPrefixes maps group/resource to the RBAC action prefix.
var patActionPrefixes = map[string]string{
	"dashboard.grafana.app/dashboards": "dashboards",
	"folder.grafana.app/folders":       "folders",
}

func patVerbSuffix(verb string) string {
	switch verb {
	case "get", "list", "watch":
		return "read"
	case "create":
		return "create"
	case "update", "patch":
		return "write"
	case "delete", "deletecollection":
		return "delete"
	}
	return ""
}

// patPermits reports whether the token's effective permissions contain the
// action needed for the request.
func patPermits(info authlib.AuthInfo, verb, group, resource, subresource string) bool {
	g, ok := tokenGrants(info)
	if !ok || g.ResourceScoped {
		return false
	}
	prefix, ok := patActionPrefixes[group+"/"+resource]
	suffix := patVerbSuffix(verb)
	if !ok || suffix == "" || subresource == "permissions" {
		return false
	}
	_, has := g.Permissions[prefix+":"+suffix]
	return has
}

func (c *patAccessClient) Check(ctx context.Context, info authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if isPersonalToken(info) && !patPermits(info, req.Verb, req.Group, req.Resource, req.Subresource) {
		return authlib.CheckResponse{Allowed: false}, nil
	}
	return c.AccessClient.Check(ctx, info, req, folder)
}

func (c *patAccessClient) Compile(ctx context.Context, info authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	if isPersonalToken(info) && !patPermits(info, req.Verb, req.Group, req.Resource, req.Subresource) {
		return nil, nil, nil
	}
	return c.AccessClient.Compile(ctx, info, req)
}

func (c *patAccessClient) BatchCheck(ctx context.Context, info authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	if !isPersonalToken(info) {
		return c.AccessClient.BatchCheck(ctx, info, req)
	}
	// Denied items are answered here; only items the token may attempt reach the owner-based client.
	denied := make(map[string]authlib.BatchCheckResult)
	forward := req
	forward.Checks = nil
	for _, item := range req.Checks {
		if patPermits(info, item.Verb, item.Group, item.Resource, item.Subresource) {
			forward.Checks = append(forward.Checks, item)
		} else {
			denied[item.CorrelationID] = authlib.BatchCheckResult{Allowed: false}
		}
	}
	if len(forward.Checks) == 0 {
		return authlib.BatchCheckResponse{Results: denied}, nil
	}
	resp, err := c.AccessClient.BatchCheck(ctx, info, forward)
	if err != nil {
		return resp, err
	}
	if resp.Results == nil {
		resp.Results = make(map[string]authlib.BatchCheckResult, len(denied))
	}
	for id, r := range denied {
		resp.Results[id] = r
	}
	return resp, nil
}
