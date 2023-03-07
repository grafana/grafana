package api

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ory/fosite"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

const grantTypeJWTBearer = "urn:ietf:params:oauth:grant-type:jwt-bearer"

func (a *api) tokenEndpoint(rw http.ResponseWriter, req *http.Request) {
	// This context will be passed to all methods.
	ctx := req.Context()

	// Create an empty session object which will be passed to the request handlers
	currentOAuthSessionData := NewPluginAuthSession("")

	// This will create an access request object and iterate through the registered TokenEndpointHandlers to validate the request.
	accessRequest, err := a.oauthProvider.NewAccessRequest(ctx, req, currentOAuthSessionData)

	// Catch any errors, e.g.:
	// * unknown client
	// * invalid redirect
	// * ...
	if err != nil {
		log.Printf("Error occurred in NewAccessRequest: %+v", err)
		a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
		return
	}

	currentOAuthSessionData.JWTClaims.Add("client_id", accessRequest.GetClient().GetID())

	if accessRequest.GetGrantTypes().ExactOne("client_credentials") {
		currentOAuthSessionData.SetSubject(accessRequest.GetClient().GetID())

		app, err := a.oauthService.GetClient(ctx, accessRequest.GetClient().GetID())
		if err != nil || app == nil {
			a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
				DescriptionField: "Could not find the requested subject.",
				ErrorField:       "not_found",
				CodeField:        http.StatusBadRequest,
			})
			return
		}

		sa, err := a.saService.RetrieveServiceAccount(ctx, 1, app.ServiceAccountID)
		if err != nil {
			if errors.Is(err, serviceaccounts.ErrServiceAccountNotFound) {
				a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
					DescriptionField: "Could not find the requested subject.",
					ErrorField:       "not_found",
					CodeField:        http.StatusBadRequest,
				})
				return
			}
			a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
				DescriptionField: "The request subject could not be processed.",
				ErrorField:       "server_error",
				CodeField:        http.StatusInternalServerError,
			})
			return
		}

		currentOAuthSessionData.Username = sa.Login
		saProfile := a.profileFromServiceAccount(sa)

		// If this is a client_credentials grant, grant all requested scopes
		// NewAccessRequest validated that all requested scopes the client is allowed to perform
		// based on configured scope matching strategy.
		for _, scope := range accessRequest.GetRequestedScopes() {
			err = a.processScopes(ctx, saProfile, scope, currentOAuthSessionData)
			if err != nil {
				a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
				return
			}
			accessRequest.GrantScope(scope)
		}
	}

	if accessRequest.GetGrantTypes().ExactOne(grantTypeJWTBearer) {
		userID, err := getUserIDFromSubject(currentOAuthSessionData.Subject)
		if err != nil {
			a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
				DescriptionField: "Could not find the requested subject.",
				ErrorField:       "not_found",
				CodeField:        http.StatusBadRequest,
			})
			return
		}

		query := user.GetUserByIDQuery{ID: userID}

		dbUser, err := a.userService.GetByID(ctx, &query)
		if err != nil {
			if errors.Is(err, user.ErrUserNotFound) {
				a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
					DescriptionField: "Could not find the requested subject.",
					ErrorField:       "not_found",
					CodeField:        http.StatusBadRequest,
				})
				return
			}
			a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, &fosite.RFC6749Error{
				DescriptionField: "The request subject could not be processed.",
				ErrorField:       "server_error",
				CodeField:        http.StatusInternalServerError,
			})
			return
		}
		currentOAuthSessionData.Username = dbUser.Login
		userProfile := a.profileFromUser(dbUser)

		for _, scope := range accessRequest.GetRequestedScopes() {
			err = a.processScopes(ctx, userProfile, scope, currentOAuthSessionData)
			if err != nil {
				a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
				return
			}
			accessRequest.GrantScope(scope)
		}

	}

	// Next we create a response for the access request. Again, we iterate through the TokenEndpointHandlers
	// and aggregate the result in response.
	response, err := a.oauthProvider.NewAccessResponse(ctx, accessRequest)
	if err != nil {
		log.Printf("Error occurred in NewAccessResponse: %+v", err)
		a.oauthProvider.WriteAccessError(ctx, rw, accessRequest, err)
		return
	}

	// All done, send the response.
	a.oauthProvider.WriteAccessResponse(ctx, rw, accessRequest, response)

	// The client now has a valid access token
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

func (a *api) profileFromUser(up *user.User) *Profile {
	return &Profile{
		Name:      up.Name,
		Email:     up.Email,
		Login:     up.Login,
		UpdatedAt: up.Updated,
		PermissionsFunc: func(ctx context.Context) (map[string][]string, error) {
			permissions, err := a.acService.SearchUsersPermissions(ctx, &a.tmpUser, 1, accesscontrol.SearchOptions{
				ActionPrefix: "dashboards",
				UserID:       up.ID,
			})
			if err != nil {
				return nil, &fosite.RFC6749Error{
					DescriptionField: "The permissions scope could not be processed.",
					ErrorField:       "server_error",
					CodeField:        http.StatusInternalServerError,
				}
			}
			if len(permissions) > 0 {
				return accesscontrol.Reduce(permissions[up.ID]), nil
			}
			return nil, nil
		},
		TeamsFunc: func(ctx context.Context) ([]string, error) {
			teams, err := a.teamService.GetTeamsByUser(ctx, &team.GetTeamsByUserQuery{
				OrgID:        1,
				UserID:       up.ID,
				SignedInUser: &a.tmpUser,
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

func (a *api) profileFromServiceAccount(sa *serviceaccounts.ServiceAccountProfileDTO) *Profile {
	return &Profile{
		Name:      sa.Name,
		Email:     fmt.Sprintf("%s@grafana.serviceaccounts.local", sa.Login),
		Login:     sa.Login,
		UpdatedAt: sa.Updated,
		PermissionsFunc: func(ctx context.Context) (map[string][]string, error) {
			permissions, err := a.acService.SearchUsersPermissions(ctx, &a.tmpUser, 1, accesscontrol.SearchOptions{
				ActionPrefix: "dashboards",
				UserID:       sa.Id,
			})
			if err != nil {
				return nil, &fosite.RFC6749Error{
					DescriptionField: "The permissions scope could not be processed.",
					ErrorField:       "server_error",
					CodeField:        http.StatusInternalServerError,
				}
			}
			if len(permissions) > 0 {
				return accesscontrol.Reduce(permissions[sa.Id]), nil
			}
			return nil, nil
		},
		TeamsFunc: func(ctx context.Context) ([]string, error) {
			return sa.Teams, nil
		},
	}
}

func (a *api) processScopes(ctx context.Context, profile *Profile, scope string, currentOAuthSessionData *PluginAuthSession) error {
	if scope == "profile" {
		// TODO: Should it be the App name?
		currentOAuthSessionData.JWTClaims.Add("name", profile.Name)
		currentOAuthSessionData.JWTClaims.Add("updated_at", profile.UpdatedAt.Unix())
	}
	if scope == "email" {
		currentOAuthSessionData.JWTClaims.Add("email", fmt.Sprintf("%s@grafana.serviceaccounts.local", profile.Login))
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
