package routing

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/web"
)

var (
	ServerError = func(err error) response.Response {
		return response.Error(http.StatusInternalServerError, "Server error", err)
	}
)

func Wrap(handler func(c *contextmodel.ReqContext) response.Response) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if res := handler(c); res != nil {
			res.WriteTo(c)
		}
	}
}

func WrapWithMspCheck(mspHandler func(c *contextmodel.ReqContext) response.Response,
	handler func(c *contextmodel.ReqContext) response.Response) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// For non-msp build, HasExternalOrg will be always false
		if !c.SignedInUser.HasExternalOrg {
			if res := handler(c); res != nil {
				res.WriteTo(c)
				return
			}
		}
		// For msp-build, we will not use mspHandler if user is ADMIN or ORG0
		if c.SignedInUser.HasRole(org.RoleAdmin) || c.SignedInUser.IsUnrestrictedUser {
			if res := handler(c); res != nil {
				res.WriteTo(c)
				return
			}
		}
		// For msp-build, we will use the mspHandler if user is not ADMIN and not ORG0
		if c.SignedInUser.HasExternalOrg {
			if res := mspHandler(c); res != nil {
				res.WriteTo(c)
			}
		}
	}
}

func WrapWithCondition(
	mspHandler func(c *contextmodel.ReqContext) response.Response,
	handler func(c *contextmodel.ReqContext) response.Response,
	condition func(c *contextmodel.ReqContext) bool,
) web.Handler {
	return func(c *contextmodel.ReqContext) {
		if condition(c) {
			if res := mspHandler(c); res != nil {
				res.WriteTo(c)
			}
		} else {
			if res := handler(c); res != nil {
				res.WriteTo(c)
			}
		}
	}
}
