package oauthimpl

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ory/fosite"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
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

func (s *OAuth2ServiceImpl) handleClientCredentials(ctx context.Context, accessRequest fosite.AccessRequester, currentOAuthSessionData *PluginAuthSession, client *oauthserver.Client) error {
	if accessRequest.GetGrantTypes().ExactOne("client_credentials") {
		currentOAuthSessionData.SetSubject(fmt.Sprintf("user:%d", client.ServiceAccountID))

		sa, err := s.saService.RetrieveServiceAccount(ctx, 1, client.ServiceAccountID)
		if err != nil {
			if errors.Is(err, serviceaccounts.ErrServiceAccountNotFound) {
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

		currentOAuthSessionData.Username = sa.Login
		saProfile := s.profileFromServiceAccount(client, sa)

		// If one of the requested scopes wasn't granted we wouldn't have reached this point
		// so we can safely grant all of them
		for _, scope := range accessRequest.GetRequestedScopes() {
			if err := s.processScopes(ctx, currentOAuthSessionData, saProfile, scope); err != nil {
				return err
			}
			accessRequest.GrantScope(scope)
		}
	}
	return nil
}

func (s *OAuth2ServiceImpl) handleJWTBearer(ctx context.Context, accessRequest fosite.AccessRequester, currentOAuthSessionData *PluginAuthSession, client *oauthserver.Client) error {
	if accessRequest.GetGrantTypes().ExactOne(grantTypeJWTBearer) {
		userID, err := getUserIDFromSubject(currentOAuthSessionData.Subject)
		if err != nil {
			return &fosite.RFC6749Error{
				DescriptionField: "Could not find the requested subject.",
				ErrorField:       "not_found",
				CodeField:        http.StatusBadRequest,
			}
		}

		// Check the service is actually allowed to impersonate the user
		// We can either check the requested scopes and make sure it contains the impersonate scope
		// or perform an access control check again.
		// There must be a better way to do this but fosites calls the GetGrantTypes without passing the subject.
		ev := ac.EvalPermission(ac.ActionUsersImpersonate, ac.Scope("users", "id", strconv.FormatInt(userID, 10)))
		hasAccess, errAccess := s.accessControl.Evaluate(ctx, client.SignedInUser, ev)
		if errAccess != nil || !hasAccess {
			return &fosite.RFC6749Error{
				DescriptionField: "Client is not allowed to impersonate subject.",
				ErrorField:       "restricted_access",
				CodeField:        http.StatusForbidden,
			}
		}

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
		userProfile := s.profileFromUser(client, dbUser)

		// If one of the requested scopes wasn't granted we wouldn't have reached this point
		// so we can safely grant all of them
		for _, scope := range accessRequest.GetRequestedScopes() {
			err = s.processScopes(ctx, currentOAuthSessionData, userProfile, scope)
			if err != nil {
				return err
			}
			accessRequest.GrantScope(scope)
		}
	}
	return nil
}

func getUserIDFromSubject(subject string) (int64, error) {
	trimmed := strings.TrimPrefix(subject, fmt.Sprintf("%s:", authn.NamespaceUser))
	return strconv.ParseInt(trimmed, 10, 64)
}

type Profile struct {
	ID              int64
	Name            string
	Email           string
	Login           string
	UpdatedAt       time.Time
	PermissionsFunc func(context.Context) (map[string][]string, error)
	TeamsFunc       func(context.Context) ([]string, error)
}

func (s *OAuth2ServiceImpl) profileFromUser(client *oauthserver.Client, up *user.User) *Profile {
	return &Profile{
		Name:      up.Name,
		Email:     up.Email,
		Login:     up.Login,
		UpdatedAt: up.Updated,
		PermissionsFunc: func(ctx context.Context) (map[string][]string, error) {
			permissions, err := s.acService.SearchUsersPermissions(ctx, client.SignedInUser,
				oauthserver.TmpOrgID, ac.SearchOptions{UserID: up.ID})
			if err != nil {
				return nil, &fosite.RFC6749Error{
					DescriptionField: "The permissions scope could not be processed.",
					ErrorField:       "server_error",
					CodeField:        http.StatusInternalServerError,
				}
			}
			if len(permissions) > 0 {
				return ac.Intersect(permissions[up.ID], client.ImpersonatePermissions), nil
			}
			return nil, nil
		},
		TeamsFunc: func(ctx context.Context) ([]string, error) {
			teams, err := s.teamService.GetTeamsByUser(ctx, &team.GetTeamsByUserQuery{
				OrgID:        1,
				UserID:       up.ID,
				SignedInUser: client.SignedInUser,
			})
			if err != nil {
				return nil, &fosite.RFC6749Error{
					DescriptionField: "The teams scope could not be processed.",
					ErrorField:       "server_error",
					CodeField:        http.StatusInternalServerError,
				}
			}
			teamNames := make([]string, 0, len(teams))
			for _, team := range teams {
				teamNames = append(teamNames, team.Name)
			}
			if len(teamNames) > 0 {
				return teamNames, nil
			}
			return nil, nil
		},
	}
}

// profileFromServiceAccount returns a Profile from a ServiceAccountProfileDTO
func (s *OAuth2ServiceImpl) profileFromServiceAccount(client *oauthserver.Client, sa *serviceaccounts.ServiceAccountProfileDTO) *Profile {
	return &Profile{
		Name:      sa.Name,
		Email:     fmt.Sprintf("%s@grafana.serviceaccounts.local", sa.Login),
		Login:     sa.Login,
		UpdatedAt: sa.Updated,
		PermissionsFunc: func(ctx context.Context) (map[string][]string, error) {
			if client.SignedInUser == nil || client.SignedInUser.Permissions == nil {
				return nil, &fosite.RFC6749Error{
					DescriptionField: "The permissions scope could not be processed.",
					ErrorField:       "server_error",
					CodeField:        http.StatusInternalServerError,
				}
			}
			permissions := client.SignedInUser.Permissions[oauthserver.TmpOrgID]
			return permissions, nil
		},
		TeamsFunc: func(ctx context.Context) ([]string, error) {
			return sa.Teams, nil
		},
	}
}

func (s *OAuth2ServiceImpl) processScopes(ctx context.Context, currentOAuthSessionData *PluginAuthSession, profile *Profile, scope string) error {
	if scope == "profile" {
		// TODO: Should it be the App name?
		currentOAuthSessionData.JWTClaims.Add("name", profile.Name)
		currentOAuthSessionData.JWTClaims.Add("updated_at", profile.UpdatedAt.Unix())
	}
	if scope == "email" {
		currentOAuthSessionData.JWTClaims.Add("email", profile.Email)
	}
	if scope == "permissions" {
		permissions, err := profile.PermissionsFunc(ctx)
		if err != nil {
			return err
		}
		currentOAuthSessionData.JWTClaims.Add("entitlements", permissions)
	}
	if scope == "teams" {
		teams, err := profile.TeamsFunc(ctx)
		if err != nil {
			return err
		}
		currentOAuthSessionData.JWTClaims.Add("groups", teams)
	}
	return nil
}

func (s *OAuth2ServiceImpl) writeAccessError(ctx context.Context, rw http.ResponseWriter, accessRequest fosite.AccessRequester, err error) {
	if fositeErr, ok := err.(*fosite.RFC6749Error); ok {
		s.logger.Error("description", fositeErr.DescriptionField, "hint", fositeErr.HintField, "error", fositeErr.ErrorField)
	} else {
		s.logger.Error("error", err)
	}
	s.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
}
