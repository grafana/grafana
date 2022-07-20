package quotaimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store            store
	AuthTokenService models.UserTokenService
	Cfg              *setting.Cfg
	SQLStore         sqlstore.Store
	Logger           log.Logger
}

func ProvideService(db db.DB, cfg *setting.Cfg, tokenService models.UserTokenService, ss *sqlstore.SQLStore) quota.Service {
	return &Service{
		store:            &sqlStore{db: db},
		Cfg:              cfg,
		AuthTokenService: tokenService,
		SQLStore:         ss,
		Logger:           log.New("quota_service"),
	}
}

// QuotaReached checks that quota is reached for a target. Runs CheckQuotaReached and take context and scope parameters from the request context
func (s *Service) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	if !s.Cfg.Quota.Enabled {
		return false, nil
	}
	// No request context means this is a background service, like LDAP Background Sync
	if c == nil {
		return false, nil
	}

	var params *quota.ScopeParameters
	if c.IsSignedIn {
		params = &quota.ScopeParameters{
			OrgID:  c.OrgId,
			UserID: c.UserId,
		}
	}
	return s.CheckQuotaReached(c.Req.Context(), target, params)
}

// CheckQuotaReached check that quota is reached for a target. If ScopeParameters are not defined, only global scope is checked
func (s *Service) CheckQuotaReached(ctx context.Context, target string, scopeParams *quota.ScopeParameters) (bool, error) {
	if !s.Cfg.Quota.Enabled {
		return false, nil
	}
	// get the list of scopes that this target is valid for. Org, User, Global
	scopes, err := s.getQuotaScopes(target)
	if err != nil {
		return false, err
	}
	for _, scope := range scopes {
		s.Logger.Debug("Checking quota", "target", target, "scope", scope)

		switch scope.Name {
		case "global":
			if scope.DefaultLimit < 0 {
				continue
			}
			if scope.DefaultLimit == 0 {
				return true, nil
			}
			if target == "session" {
				usedSessions, err := s.AuthTokenService.ActiveTokenCount(ctx)
				if err != nil {
					return false, err
				}

				if usedSessions > scope.DefaultLimit {
					s.Logger.Debug("Sessions limit reached", "active", usedSessions, "limit", scope.DefaultLimit)
					return true, nil
				}
				continue
			}
			query := models.GetGlobalQuotaByTargetQuery{Target: scope.Target, UnifiedAlertingEnabled: s.Cfg.UnifiedAlerting.IsEnabled()}
			// TODO : move GetGlobalQuotaByTarget to a global quota service
			if err := s.SQLStore.GetGlobalQuotaByTarget(ctx, &query); err != nil {
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
				OrgId:                  scopeParams.OrgID,
				Target:                 scope.Target,
				Default:                scope.DefaultLimit,
				UnifiedAlertingEnabled: s.Cfg.UnifiedAlerting.IsEnabled(),
			}
			// TODO: move GetOrgQuotaByTarget from sqlstore to quota store
			if err := s.SQLStore.GetOrgQuotaByTarget(ctx, &query); err != nil {
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
			if scopeParams == nil || scopeParams.UserID == 0 {
				continue
			}
			query := models.GetUserQuotaByTargetQuery{UserId: scopeParams.UserID, Target: scope.Target, Default: scope.DefaultLimit, UnifiedAlertingEnabled: s.Cfg.UnifiedAlerting.IsEnabled()}
			// TODO: move GetUserQuotaByTarget from sqlstore to quota store
			if err := s.SQLStore.GetUserQuotaByTarget(ctx, &query); err != nil {
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

func (s *Service) getQuotaScopes(target string) ([]models.QuotaScope, error) {
	scopes := make([]models.QuotaScope, 0)
	switch target {
	case "user":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.User},
			models.QuotaScope{Name: "org", Target: "org_user", DefaultLimit: s.Cfg.Quota.Org.User},
		)
		return scopes, nil
	case "org":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.Org},
			models.QuotaScope{Name: "user", Target: "org_user", DefaultLimit: s.Cfg.Quota.User.Org},
		)
		return scopes, nil
	case "dashboard":
		scopes = append(scopes,
			models.QuotaScope{
				Name:         "global",
				Target:       target,
				DefaultLimit: s.Cfg.Quota.Global.Dashboard,
			},
			models.QuotaScope{
				Name:         "org",
				Target:       target,
				DefaultLimit: s.Cfg.Quota.Org.Dashboard,
			},
		)
		return scopes, nil
	case "data_source":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.DataSource},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: s.Cfg.Quota.Org.DataSource},
		)
		return scopes, nil
	case "api_key":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.ApiKey},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: s.Cfg.Quota.Org.ApiKey},
		)
		return scopes, nil
	case "session":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.Session},
		)
		return scopes, nil
	case "alert_rule": // target need to match the respective database name
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.AlertRule},
			models.QuotaScope{Name: "org", Target: target, DefaultLimit: s.Cfg.Quota.Org.AlertRule},
		)
		return scopes, nil
	case "file":
		scopes = append(scopes,
			models.QuotaScope{Name: "global", Target: target, DefaultLimit: s.Cfg.Quota.Global.File},
		)
		return scopes, nil
	default:
		return scopes, quota.ErrInvalidQuotaTarget
	}
}

func (s *Service) DeleteByUser(ctx context.Context, userID int64) error {
	return s.store.DeleteByUser(ctx, userID)
}
