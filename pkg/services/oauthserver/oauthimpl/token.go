package oauthimpl

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/ory/fosite"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

const grantTypeJWTBearer = "urn:ietf:params:oauth:grant-type:jwt-bearer"

func (s *OAuth2ServiceImpl) HandleTokenRequest(rw http.ResponseWriter, req *http.Request) {
	// This context will be passed to all methods.
	ctx := req.Context()

	// Create an empty session object which will be passed to the request handlers
	currentOAuthSessionData := NewPluginAuthSession("")

	// This will create an access request object and iterate through the registered TokenEndpointHandlers to validate the request.
	accessRequest, err := s.oauthProvider.NewAccessRequest(ctx, req, currentOAuthSessionData)
	if err != nil {
		s.writeAccessError(ctx, rw, accessRequest, err)
		return
	}

	app, err := s.GetExternalService(ctx, accessRequest.GetClient().GetID())
	if err != nil || app == nil {
		s.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
			DescriptionField: "Could not find the requested subject.",
			ErrorField:       "not_found",
			CodeField:        http.StatusBadRequest,
		})
		return
	}
	currentOAuthSessionData.JWTClaims.Add("client_id", app.ClientID)

	errClientCred := s.handleClientCredentials(ctx, accessRequest, currentOAuthSessionData, app)
	if errClientCred != nil {
		s.writeAccessError(ctx, rw, accessRequest, errClientCred)
		return
	}

	errJWTBearer := s.handleJWTBearer(ctx, accessRequest, currentOAuthSessionData, app)
	if errJWTBearer != nil {
		s.writeAccessError(ctx, rw, accessRequest, errJWTBearer)
		return
	}

	// Next we create a response for the access request. Again, we iterate through the TokenEndpointHandlers
	// and aggregate the result in response.
	response, err := s.oauthProvider.NewAccessResponse(ctx, accessRequest)
	if err != nil {
		s.writeAccessError(ctx, rw, accessRequest, err)
		return
	}

	// All done, send the response.
	// The client now has a valid access token
	s.oauthProvider.WriteAccessResponse(ctx, rw, accessRequest, response)
}

func getUserIDFromSubject(subject string) (int64, error) {
	trimmed := strings.TrimPrefix(subject, fmt.Sprintf("%s:", authn.NamespaceUser))
	return strconv.ParseInt(trimmed, 10, 64)
}

func (s *OAuth2ServiceImpl) writeAccessError(ctx context.Context, rw http.ResponseWriter, accessRequest fosite.AccessRequester, err error) {
	if fositeErr, ok := err.(*fosite.RFC6749Error); ok {
		s.logger.Error("description", fositeErr.DescriptionField, "hint", fositeErr.HintField, "error", fositeErr.ErrorField)
	} else {
		s.logger.Error("error", err)
	}
	s.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
}

func splitOAuthScopes(requestedScopes fosite.Arguments) (map[string]bool, map[string]bool) {
	actionsFilter := map[string]bool{}
	claimsFilter := map[string]bool{}
	for _, scope := range requestedScopes {
		switch scope {
		case "profile", "email", "groups", "entitlements", "org.1":
			claimsFilter[scope] = true
		default:
			actionsFilter[scope] = true
		}
	}
	return actionsFilter, claimsFilter
}

func (s *OAuth2ServiceImpl) handleJWTBearer(ctx context.Context, accessRequest fosite.AccessRequester, currentOAuthSessionData *PluginAuthSession, client *oauthserver.Client) error {
	if !accessRequest.GetGrantTypes().ExactOne(grantTypeJWTBearer) {
		return nil
	}

	userID, err := getUserIDFromSubject(currentOAuthSessionData.Subject)
	if err != nil {
		return &fosite.RFC6749Error{
			DescriptionField: "Could not find the requested subject.",
			ErrorField:       "not_found",
			CodeField:        http.StatusBadRequest,
		}
	}

	// If the client was not allowed to impersonate the user we would not have reached this point given allowed scopes would have been empty
	// But just in case we check again
	ev := ac.EvalPermission(ac.ActionUsersImpersonate, ac.Scope("users", "id", strconv.FormatInt(userID, 10)))
	hasAccess, errAccess := s.accessControl.Evaluate(ctx, client.SignedInUser, ev)
	if errAccess != nil || !hasAccess {
		return &fosite.RFC6749Error{
			DescriptionField: "Client is not allowed to impersonate subject.",
			ErrorField:       "restricted_access",
			CodeField:        http.StatusForbidden,
		}
	}

	// Split scopes into actions and claims
	actionsFilter, claimsFilter := splitOAuthScopes(accessRequest.GetGrantedScopes())

	// Get the user
	query := user.GetUserByIDQuery{ID: userID}
	dbUser, err := s.userService.GetByID(ctx, &query)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return &fosite.RFC6749Error{
				DescriptionField: "Could not find the requested subject.",
				ErrorField:       "not_found",
				CodeField:        http.StatusBadRequest,
			}
		}
		return &fosite.RFC6749Error{
			DescriptionField: "The request subject could not be processed.",
			ErrorField:       "server_error",
			CodeField:        http.StatusInternalServerError,
		}
	}
	currentOAuthSessionData.Username = dbUser.Login

	teams := []*team.TeamDTO{}
	// Fetch teams if the groups scope is requested or if we need to populate it in the entitlements
	if claimsFilter["groups"] ||
		(claimsFilter["entitlements"] && (len(actionsFilter) == 0 || actionsFilter["teams:read"])) {
		var errGetTeams error
		teams, errGetTeams = s.teamService.GetTeamsByUser(ctx, &team.GetTeamsByUserQuery{
			OrgID:  oauthserver.TmpOrgID,
			UserID: dbUser.ID,
			// Fetch teams without restriction on permissions
			SignedInUser: &user.SignedInUser{
				OrgID: oauthserver.TmpOrgID,
				Permissions: map[int64]map[string][]string{
					oauthserver.TmpOrgID: {
						ac.ActionTeamsRead: {ac.ScopeTeamsAll},
					},
				},
			},
		})
		if errGetTeams != nil {
			return &fosite.RFC6749Error{
				DescriptionField: "The teams scope could not be processed.",
				ErrorField:       "server_error",
				CodeField:        http.StatusInternalServerError,
			}
		}
	}

	if claimsFilter["profile"] {
		currentOAuthSessionData.JWTClaims.Add("name", dbUser.Name)
		currentOAuthSessionData.JWTClaims.Add("login", dbUser.Login)
		currentOAuthSessionData.JWTClaims.Add("updated_at", dbUser.Updated.Unix())
	}
	if claimsFilter["email"] {
		currentOAuthSessionData.JWTClaims.Add("email", dbUser.Email)
	}
	if claimsFilter["groups"] {
		teamNames := make([]string, 0, len(teams))
		for _, team := range teams {
			teamNames = append(teamNames, team.Name)
		}
		currentOAuthSessionData.JWTClaims.Add("groups", teamNames)
	}

	if claimsFilter["entitlements"] {
		// Get the user permissions (apply the actions filter)
		permissions, errGetPermission := s.filteredUserPermissions(ctx, userID, actionsFilter)
		if errGetPermission != nil {
			return errGetPermission
		}

		// Compute the impersonated permissions (apply the actions filter, replace the scope self with the user id)
		impPerms := s.filteredImpersonatePermissions(client.ImpersonatePermissions, userID, teams, actionsFilter)

		// Intersect the permissions with the client permissions
		intesect := ac.Intersect(permissions, impPerms)

		currentOAuthSessionData.JWTClaims.Add("entitlements", intesect)
	}

	return nil
}

func (s *OAuth2ServiceImpl) filteredUserPermissions(ctx context.Context, userID int64, actionsFilter map[string]bool) ([]ac.Permission, error) {
	permissions := []ac.Permission{}

	// TODO find a more efficient way to get the user permissions
	tmpUser := &user.SignedInUser{
		OrgID: oauthserver.TmpOrgID,
		Permissions: map[int64]map[string][]string{
			oauthserver.TmpOrgID: {
				ac.ActionUsersPermissionsRead: {ac.Scope("users", "id", strconv.FormatInt(userID, 10))},
			},
		},
	}
	permissionsMap, err := s.acService.SearchUsersPermissions(ctx, tmpUser, oauthserver.TmpOrgID, ac.SearchOptions{UserID: userID})
	if err != nil {
		return nil, &fosite.RFC6749Error{
			DescriptionField: "The permissions scope could not be processed.",
			ErrorField:       "server_error",
			CodeField:        http.StatusInternalServerError,
		}
	}
	if permissionsMap != nil && permissionsMap[userID] != nil {
		permissions = permissionsMap[userID]
	}

	// Apply the actions filter
	if len(actionsFilter) > 0 {
		filtered := []ac.Permission{}
		for i := range permissions {
			if actionsFilter[permissions[i].Action] {
				filtered = append(filtered, permissions[i])
			}
		}
		permissions = filtered
	}
	return permissions, nil
}

func (*OAuth2ServiceImpl) filteredImpersonatePermissions(impersonatePermissions []ac.Permission, userID int64, teams []*team.TeamDTO, actionsFilter map[string]bool) []ac.Permission {
	// Compute the impersonated permissions
	impPerms := impersonatePermissions
	// Apply the actions filter
	if len(actionsFilter) > 0 {
		filtered := []ac.Permission{}
		for i := range impPerms {
			if actionsFilter[impPerms[i].Action] {
				filtered = append(filtered, impPerms[i])
			}
		}
		impPerms = filtered
	}

	// Replace the scope self with the user id
	correctScopes := []ac.Permission{}
	for i := range impPerms {
		switch impPerms[i].Scope {
		case oauthserver.ScopeGlobalUsersSelf:
			correctScopes = append(correctScopes, ac.Permission{
				Action: impPerms[i].Action,
				Scope:  ac.Scope("global.users", "id", strconv.FormatInt(userID, 10)),
			})
		case oauthserver.ScopeUsersSelf:
			correctScopes = append(correctScopes, ac.Permission{
				Action: impPerms[i].Action,
				Scope:  ac.Scope("users", "id", strconv.FormatInt(userID, 10)),
			})
		case oauthserver.ScopeTeamsSelf:
			for t := range teams {
				correctScopes = append(correctScopes, ac.Permission{
					Action: impPerms[i].Action,
					Scope:  ac.Scope("teams", "id", strconv.FormatInt(teams[t].ID, 10)),
				})
			}
		default:
			correctScopes = append(correctScopes, impPerms[i])
		}
		continue
	}
	return correctScopes
}

func (s *OAuth2ServiceImpl) handleClientCredentials(ctx context.Context, accessRequest fosite.AccessRequester, currentOAuthSessionData *PluginAuthSession, client *oauthserver.Client) error {
	if !accessRequest.GetGrantTypes().ExactOne("client_credentials") {
		return nil
	}
	currentOAuthSessionData.SetSubject(fmt.Sprintf("user:%d", client.ServiceAccountID))

	sa := client.SignedInUser
	if sa == nil {
		return &fosite.RFC6749Error{
			DescriptionField: "Could not find the service account of the client",
			ErrorField:       "not_found",
			CodeField:        http.StatusNotFound,
		}
	}
	currentOAuthSessionData.Username = sa.Login

	// For client credentials, scopes are not marked as granted by fosite but the request would have been rejected
	// already if the client was not allowed to request them
	for _, scope := range accessRequest.GetRequestedScopes() {
		accessRequest.GrantScope(scope)
	}

	// Split scopes into actions and claims
	actionsFilter, claimsFilter := splitOAuthScopes(accessRequest.GetGrantedScopes())

	if claimsFilter["profile"] {
		currentOAuthSessionData.JWTClaims.Add("name", sa.Name)
		currentOAuthSessionData.JWTClaims.Add("login", sa.Login)
	}
	if claimsFilter["email"] {
		s.logger.Debug("Service accounts have no emails")
	}
	if claimsFilter["groups"] {
		s.logger.Debug("Service accounts have no groups")
	}
	if claimsFilter["entitlements"] {
		s.logger.Debug("Processing client entitlements")
		if sa.Permissions != nil && sa.Permissions[oauthserver.TmpOrgID] != nil {
			perms := sa.Permissions[oauthserver.TmpOrgID]
			if len(actionsFilter) > 0 {
				filtered := map[string][]string{}
				for action := range actionsFilter {
					if _, ok := perms[action]; ok {
						filtered[action] = perms[action]
					}
				}
				perms = filtered
			}
			currentOAuthSessionData.JWTClaims.Add("entitlements", perms)
		} else {
			s.logger.Debug("Client has no permissions")
		}
	}

	return nil
}
