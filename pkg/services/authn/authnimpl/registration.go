package authnimpl

import (
	"context"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/gcomsso"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authnimpl/sync"
	"github.com/grafana/grafana/pkg/services/authn/clients"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	tempuser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Registration struct{}

func ProvideRegistration(
	cfg *setting.Cfg, authnSvc authn.Service,
	orgService org.Service, sessionService auth.UserTokenService,
	accessControlService accesscontrol.Service, permRegistry permreg.PermissionRegistry,
	apikeyService apikey.Service, userService user.Service,
	jwtService auth.JWTVerifierService, userProtectionService login.UserProtectionService,
	loginAttempts loginattempt.Service, quotaService quota.Service,
	authInfoService login.AuthInfoService, renderService rendering.Service,
	features featuremgmt.FeatureToggles, oauthTokenService oauthtoken.OAuthTokenService,
	socialService social.Service, cache *remotecache.RemoteCache,
	ldapService service.LDAP, settingsProviderService setting.Provider,
	tracer tracing.Tracer, tempUserService tempuser.Service, notificationService notifications.Service,
	teamService team.Service,
) Registration {
	logger := log.New("authn.registration")

	authnSvc.RegisterClient(clients.ProvideRender(renderService))
	authnSvc.RegisterClient(clients.ProvideAPIKey(apikeyService, tracer))

	if cfg.LoginCookieName != "" {
		authnSvc.RegisterClient(clients.ProvideSession(cfg, sessionService, authInfoService, tracer))
	}

	var proxyClients []authn.ProxyClient
	var passwordClients []authn.PasswordClient

	ldap := clients.ProvideLDAP(cfg, ldapService, userService, authInfoService, tracer)
	proxyClients = append(proxyClients, ldap)
	passwordClients = append(passwordClients, ldap)

	if !cfg.DisableLogin {
		grafana := clients.ProvideGrafana(cfg, userService, tracer)
		proxyClients = append(proxyClients, grafana)
		passwordClients = append(passwordClients, grafana)
	}

	// if we have password clients configure check if basic auth or form auth is enabled
	if len(passwordClients) > 0 {
		passwordClient := clients.ProvidePassword(loginAttempts, tracer, passwordClients...)
		if cfg.BasicAuthEnabled {
			authnSvc.RegisterClient(clients.ProvideBasic(passwordClient))
		}

		if !cfg.DisableLoginForm {
			authnSvc.RegisterClient(clients.ProvideForm(passwordClient))
		}
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if cfg.PasswordlessMagicLinkAuth.Enabled && features.IsEnabled(context.Background(), featuremgmt.FlagPasswordlessMagicLinkAuthentication) {
		hasEnabledProviders := authnSvc.IsClientEnabled(authn.ClientSAML) || authnSvc.IsClientEnabled(authn.ClientLDAP)
		if !hasEnabledProviders {
			oauthInfos := socialService.GetOAuthInfoProviders()
			for _, provider := range oauthInfos {
				if provider.Enabled {
					hasEnabledProviders = true
					break
				}
			}
		}

		if hasEnabledProviders {
			logger.Error("Failed to configure passwordless magic link auth: cannot enable both passwordless magic link auth & SSO")
		} else {
			passwordless := clients.ProvidePasswordless(cfg, loginAttempts, userService, tempUserService, notificationService, cache)
			authnSvc.RegisterClient(passwordless)
		}
	}

	if cfg.AuthProxy.Enabled && len(proxyClients) > 0 {
		proxy, err := clients.ProvideProxy(cfg, cache, tracer, proxyClients...)
		if err != nil {
			logger.Error("Failed to configure auth proxy", "err", err)
		} else {
			authnSvc.RegisterClient(proxy)
		}
	}

	if cfg.JWTAuth.Enabled {
		orgRoleMapper := connectors.ProvideOrgRoleMapper(cfg, orgService)
		authnSvc.RegisterClient(clients.ProvideJWT(jwtService, orgRoleMapper, cfg, tracer))
	}

	if cfg.ExtJWTAuth.Enabled {
		authnSvc.RegisterClient(clients.ProvideExtendedJWT(cfg, tracer))
	}

	for name := range socialService.GetOAuthProviders() {
		clientName := authn.ClientWithPrefix(name)
		authnSvc.RegisterClient(clients.ProvideOAuth(clientName, cfg, oauthTokenService, socialService, settingsProviderService, features, tracer))
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		authnSvc.RegisterClient(clients.ProvideProvisioning())
	}

	// FIXME (jguer): move to User package
	// Pass nil for k8sClient - it will be handled gracefully in the SCIMSettingsUtil
	userSync := sync.ProvideUserSync(userService, userProtectionService, authInfoService, quotaService, tracer, features, cfg, nil)
	orgSync := sync.ProvideOrgSync(userService, orgService, accessControlService, cfg, tracer)
	authnSvc.RegisterPostAuthHook(userSync.SyncUserHook, 10)
	authnSvc.RegisterPostAuthHook(userSync.EnableUserHook, 20)
	authnSvc.RegisterPostAuthHook(orgSync.SyncOrgRolesHook, 40)
	authnSvc.RegisterPostAuthHook(userSync.SyncLastSeenHook, 130)
	authnSvc.RegisterPostAuthHook(sync.ProvideOAuthTokenSync(oauthTokenService, sessionService, socialService, tracer, features).SyncOauthTokenHook, 60)
	authnSvc.RegisterPostAuthHook(userSync.FetchSyncedUserHook, 100)

	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagEnableSCIM) {
		authnSvc.RegisterPostAuthHook(userSync.ValidateUserProvisioningHook, 30)
	}

	rbacSync := sync.ProvideRBACSync(accessControlService, tracer, permRegistry)
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagCloudRBACRoles) {
		authnSvc.RegisterPostAuthHook(rbacSync.SyncCloudRoles, 110)
		authnSvc.RegisterPreLogoutHook(gcomsso.ProvideGComSSOService(cfg).LogoutHook, 50)
	}

	authnSvc.RegisterPostAuthHook(rbacSync.SyncPermissionsHook, 120)
	authnSvc.RegisterPostLoginHook(orgSync.SetDefaultOrgHook, 140)
	authnSvc.RegisterPostLoginHook(userSync.CatalogLoginHook, 145)
	authnSvc.RegisterPostLoginHook(rbacSync.ClearUserPermissionCacheHook, 170)

	// Clear team member cache on login to ensure fresh session data
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagTeamMembershipQueryCache) {
		clearCacheHook := func(ctx context.Context, identity *authn.Identity, r *authn.Request, err error) {
			if err != nil || identity == nil {
				return
			}

			// Parse user ID from identity
			userID, parseErr := strconv.ParseInt(identity.GetID(), 10, 64)
			if parseErr != nil {
				logger.Warn("Failed to parse user ID for cache clearing", "id", identity.GetID(), "error", parseErr)
				return
			}

			// Get the member cache from team service if it implements the interface
			if teamSvc, ok := teamService.(interface {
				GetMemberCache() teamimpl.MemberCache
			}); ok {
				memberCache := teamSvc.GetMemberCache()
				memberCache.ClearUser(ctx, userID)
				logger.Debug("Cleared team member cache on login", "userID", userID)
			}
		}
		authnSvc.RegisterPostLoginHook(clearCacheHook, 175) // Priority after permission cache clear (170)
	}

	nsSync := sync.ProvideNamespaceSync(cfg)
	authnSvc.RegisterPostAuthHook(nsSync.SyncNamespace, 150)
	authnSvc.RegisterPostAuthHook(sync.AccessClaimsHook, 160)

	return Registration{}
}
