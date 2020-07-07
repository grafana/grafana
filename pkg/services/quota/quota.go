package quota

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	registry.RegisterService(&QuotaService{})
}

type QuotaService struct {
	AuthTokenService models.UserTokenService `inject:""`
}

func (qs *QuotaService) Init() error {
	return nil
}

func (qs *QuotaService) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	if !setting.Quota.Enabled {
		return false, nil
	}
	// No request context means this is a background service, like LDAP Background Sync.
	// TODO: we should replace the req context with a more limited interface or struct,
	//       something that we could easily provide from background jobs.
	if c == nil {
		return false, nil
	}
	// get the list of scopes that this target is valid for. Org, User, Global
	scopes, err := models.GetQuotaScopes(target)
	if err != nil {
		return false, err
	}

	for _, scope := range scopes {
		c.Logger.Debug("Checking quota", "target", target, "scope", scope)

		switch scope.Name {
		case "global":
			if scope.DefaultLimit < 0 {
				continue
			}
			if scope.DefaultLimit == 0 {
				return true, nil
			}
			if target == "session" {
				usedSessions, err := qs.AuthTokenService.ActiveTokenCount(c.Req.Context())
				if err != nil {
					return false, err
				}

				if usedSessions > scope.DefaultLimit {
					c.Logger.Debug("Sessions limit reached", "active", usedSessions, "limit", scope.DefaultLimit)
					return true, nil
				}
				continue
			}
			query := models.GetGlobalQuotaByTargetQuery{Target: scope.Target}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Used >= scope.DefaultLimit {
				return true, nil
			}
		case "org":
			if !c.IsSignedIn {
				continue
			}
			query := models.GetOrgQuotaByTargetQuery{OrgId: c.OrgId, Target: scope.Target, Default: scope.DefaultLimit}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Limit < 0 {
				continue
			}
			if query.Result.Limit == 0 {
				return true, nil
			}

			if query.Result.Used >= query.Result.Limit {
				return true, nil
			}
		case "user":
			if !c.IsSignedIn || c.UserId == 0 {
				continue
			}
			query := models.GetUserQuotaByTargetQuery{UserId: c.UserId, Target: scope.Target, Default: scope.DefaultLimit}
			if err := bus.Dispatch(&query); err != nil {
				return true, err
			}
			if query.Result.Limit < 0 {
				continue
			}
			if query.Result.Limit == 0 {
				return true, nil
			}

			if query.Result.Used >= query.Result.Limit {
				return true, nil
			}
		}
	}

	return false, nil
}
