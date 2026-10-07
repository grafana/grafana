package datasource

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

// NewProxyRouteAccessChecker delegates plugin route actions unchanged to authz.
func NewProxyRouteAccessChecker(client authlib.AccessClient, group string) pluginproxy.RouteAccessChecker {
	return func(ctx context.Context, user identity.Requester, uid, action string) (bool, error) {
		ns, err := request.NamespaceInfoFrom(ctx, false)
		if err != nil {
			return false, err
		}
		check := authlib.CheckRequest{Namespace: ns.Value, Group: group, Resource: "datasources", Name: uid, Verb: action}
		response, err := client.Check(ctx, user, check, "")
		if err != nil {
			return false, err
		}
		return response.Allowed, nil
	}
}
