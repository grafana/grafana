package quota

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var ErrInvalidQuotaTarget = errors.New("invalid quota target")

func ProvideService(cfg *setting.Cfg, tokenService models.UserTokenService, sqlStore *sqlstore.SQLStore) *QuotaService {
	return &QuotaService{
		Cfg:              cfg,
		AuthTokenService: tokenService,
		SQLStore:         sqlStore,
		Logger:           log.New("quota_service"),
	}
}

type QuotaService struct {
	AuthTokenService models.UserTokenService
	Cfg              *setting.Cfg
	SQLStore         sqlstore.Store
	Logger           log.Logger
}

type Service interface {
	QuotaReached(c *models.ReqContext, target string) (bool, error)
	CheckQuotaReached(ctx context.Context, target string, scopeParams *ScopeParameters) (bool, error)
}

type ScopeParameters struct {
	OrgId  int64
	UserId int64
}

// QuotaReached checks that quota is reached for a target. Runs CheckQuotaReached and take context and scope parameters from the request context
func (qs *QuotaService) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	if !qs.Cfg.Quota.Enabled {
		return false, nil
	}
	// No request context means this is a background service, like LDAP Background Sync
	if c == nil {
		return false, nil
	}

	var params *ScopeParameters
	if c.IsSignedIn {
		params = &ScopeParameters{
			OrgId:  c.OrgId,
			UserId: c.UserId,
		}
	}
	return qs.CheckQuotaReached(c.Req.Context(), target, params)
}

// CheckQuotaReached check that quota is reached for a target. If ScopeParameters are not defined, only global scope is checked
func (qs *QuotaService) CheckQuotaReached(ctx context.Context, target string, scopeParams *ScopeParameters) (bool, error) {
	if !qs.Cfg.Quota.Enabled {
		return false, nil
	}
	// get the list of scopes that this target is valid for. Org, User, Global
	scopes, err := qs.getQuotaScopes(target)
	if err != nil {
		return false, err
	}
	for _, scope := range scopes {
		qs.Logger.Debug("Checking quota", "target", target, "scope", scope)

		switch scope.Name {
		case "global":
			if scope.DefaultLimit < 0 {
				continue
			}
			if scope.DefaultLimit == 0 {
				return true, nil
			}
			if target == "session" {
				usedSessions, err := qs.AuthTokenService.ActiveTokenCount(ctx)
				if err != nil {
					return false, err
				}

				if usedSessions > scope.DefaultLimit {
					qs.Logger.Debug("Sessions limit reached", "active", usedSessions, "limit", scope.DefaultLimit)
					return true, nil
				}
				continue
			}
			query := models.GetGlobalQuotaByTargetQuery{Target: scope.Target, UnifiedAlertingEnabled: qs.Cfg.UnifiedAlerting.IsEnabled()}
			if err := qs.SQLStore.GetGlobalQuotaByTarget(ctx, &query); err != nil {
				return true, err
			}
			if query.Result.Used >= scope.DefaultLimit {
				return true, nil
			}
		case "org":
			if scopeParams == nil {
				continue
			}
			query := models.GetOrgQuotaByTargetQuery{
				OrgId:                  scopeParams.OrgId,
				Target:                 scope.Target,
				Default:                scope.DefaultLimit,
				UnifiedAlertingEnabled: qs.Cfg.UnifiedAlerting.IsEnabled(),
			}
			if err := qs.SQLStore.GetOrgQuotaByTarget(ctx, &query); err != nil {
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
			if scopeParams == nil || scopeParams.UserId == 0 {
				continue
			}
			query := models.GetUserQuotaByTargetQuery{UserId: scopeParams.UserId, Target: scope.Target, Default: scope.DefaultLimit, UnifiedAlertingEnabled: qs.Cfg.UnifiedAlerting.IsEnabled()}
			if err := qs.SQLStore.GetUserQuotaByTarget(ctx, &query); err != nil {
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

func (qs *QuotaService) getQuotaScopes(target string) ([]models.QuotaScope, error) {
	scopes := make([]models.QuotaScope, 0)
	switch target {
	case "user":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.User},
			models.QuotaScope{Name: "org", Target: "org_user", DefaultLimit: qs.Cfg.Quota.Org.User},
		)
		return scopes, nil
	case "org":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.Org},
			models.QuotaScope{Name: "user", Target: "org_user", DefaultLimit: qs.Cfg.Quota.User.Org},
		)
		return scopes, nil
	case "dashboard":
		scopes = append(scopes,
			models.QuotaScope{
				Name:         "global",
				Target:       target,
				DefaultLimit: qs.Cfg.Quota.Global.Dashboard,
			},
			models.QuotaScope{
				Name:         "org",
				Target:       target,
				DefaultLimit: qs.Cfg.Quota.Org.Dashboard,
			},
		)
		return scopes, nil
	case "data_source":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.DataSource},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.DataSource},
		)
		return scopes, nil
	case "api_key":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.ApiKey},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.ApiKey},
		)
		return scopes, nil
	case "session":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.Session},
		)
		return scopes, nil
	case "alert_rule": // target need to match the respective database name
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: qs.Cfg.Quota.Global.AlertRule},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: qs.Cfg.Quota.Org.AlertRule},
		)
		return scopes, nil
	default:
		return scopes, ErrInvalidQuotaTarget
	}
}
