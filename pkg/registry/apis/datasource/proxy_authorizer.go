package datasource

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
)

// NewProxyRouteAccessChecker sends supported plugin route actions unchanged to
// authz. Unknown actions fail closed instead of falling back to the basic role.
func NewProxyRouteAccessChecker(client authlib.AccessClient, group string) pluginproxy.RouteAccessChecker {
	return func(ctx context.Context, user identity.Requester, uid, action string) (bool, error) {
		ns, err := request.NamespaceInfoFrom(ctx, false)
		if err != nil {
			return false, err
		}
		switch action {
		case datasources.ActionQuery, accesscontrol.ActionAlertingRuleExternalRead, accesscontrol.ActionAlertingRuleExternalWrite:
		default:
			return false, fmt.Errorf("unsupported datasource proxy route action %q", action)
		}
		check := authlib.CheckRequest{Namespace: ns.Value, Group: group, Resource: "datasources", Name: uid, Verb: action}
		response, err := client.Check(ctx, user, check, "")
		if err != nil {
			return false, err
		}
		return response.Allowed, nil
	}
}
