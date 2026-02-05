package teamapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	"github.com/open-feature/go-sdk/openfeature"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// swagger:route GET /teams/{team_id}/members teams getTeamMembers
//
// Get Team Members.
//
// Responses:
// 200: getTeamMembersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (tapi *TeamAPI) getTeamMembers(c *contextmodel.ReqContext) response.Response {
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	query := team.GetTeamMembersQuery{OrgID: c.GetOrgID(), TeamID: teamId, SignedInUser: c.SignedInUser}

	queryResult, err := tapi.teamService.GetTeamMembers(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get Team Members", err)
	}

	filteredMembers := make([]*team.TeamMemberDTO, 0, len(queryResult))
	for _, member := range queryResult {
		if dtos.IsHiddenUser(member.Login, c.SignedInUser, tapi.cfg) {
			continue
		}

		member.AvatarURL = dtos.GetGravatarUrl(tapi.cfg, member.Email)
		member.Labels = []string{}

		if tapi.license.FeatureEnabled("teamgroupsync") && member.External {
			authProvider := login.GetAuthProviderLabel(member.AuthModule)
			member.Labels = append(member.Labels, authProvider)
		}

		filteredMembers = append(filteredMembers, member)
	}

	return response.JSON(http.StatusOK, filteredMembers)
}

// swagger:route POST /teams/{team_id}/members teams addTeamMember
//
// Add Team Member.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (tapi *TeamAPI) addTeamMember(c *contextmodel.ReqContext) response.Response {
	cmd := team.AddTeamMemberCommand{}
	var err error
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamID, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	resp := tapi.validateTeam(c, teamID, "Team memberships cannot be updated for provisioned teams")
	if resp != nil {
		return resp
	}

	isTeamMember, err := tapi.teamService.IsTeamMember(c.Req.Context(), c.GetOrgID(), teamID, cmd.UserID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to add team member.", err)
	}
	if isTeamMember {
		return response.Error(http.StatusBadRequest, "User is already added to this team", nil)
	}

	err = addOrUpdateTeamMember(
		c.Req.Context(), tapi.teamPermissionsService,
		cmd.UserID, c.GetOrgID(), teamID, team.PermissionTypeMember.String(),
	)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to add Member to Team", err)
	}

	return response.JSON(http.StatusOK, &util.DynMap{
		"message": "Member added to Team",
	})
}

// swagger:route PUT /teams/{team_id}/members/{user_id} teams updateTeamMember
//
// Update Team Member.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (tapi *TeamAPI) updateTeamMember(c *contextmodel.ReqContext) response.Response {
	cmd := team.UpdateTeamMemberCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}
	orgId := c.GetOrgID()

	resp := tapi.validateTeam(c, teamId, "Team memberships cannot be updated for provisioned teams")
	if resp != nil {
		return resp
	}

	isTeamMember, err := tapi.teamService.IsTeamMember(c.Req.Context(), orgId, teamId, userId)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update team member.", err)
	}
	if !isTeamMember {
		return response.Error(http.StatusNotFound, "Team member not found.", nil)
	}

	err = addOrUpdateTeamMember(c.Req.Context(), tapi.teamPermissionsService, userId, orgId, teamId, cmd.Permission.String())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update team member.", err)
	}
	return response.Success("Team member updated")
}

// swagger:route PUT /teams/{team_id}/members teams setTeamMemberships
//
// Set team memberships.
//
// Takes user emails, and updates team members and admins to the provided lists of users.
// Any current team members and admins not in the provided lists will be removed.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (tapi *TeamAPI) setTeamMemberships(c *contextmodel.ReqContext) response.Response {
	var (
		ctx                   = c.Req.Context()
		defaultShouldRedirect = false
	)

	shouldRedirect := openfeature.NewDefaultClient().Boolean(
		ctx,
		featuremgmt.FlagKubernetesTeamsHandlerRedirect,
		defaultShouldRedirect,
		openfeature.TransactionContext(ctx),
	)

	if shouldRedirect {
		// Call the TeamBinding API to update team memberships
		return tapi.setTeamMembershipsViaK8s(c)
	}

	cmd := team.SetTeamMembershipsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	orgId := c.GetOrgID()

	resp := tapi.validateTeam(c, teamId, "Team memberships cannot be updated for provisioned teams")
	if resp != nil {
		return resp
	}

	teamMemberships, err := tapi.getTeamMembershipUpdates(c.Req.Context(), orgId, teamId, cmd, c.SignedInUser)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) || errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to parse team membership updates", err)
	}

	_, err = tapi.teamPermissionsService.SetPermissions(c.Req.Context(), orgId, strconv.FormatInt(teamId, 10), teamMemberships...)
	if err != nil {
		if errors.Is(err, user.ErrUserNotFound) || errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update team memberships", err)
	}

	return response.Success("Team memberships have been updated")
}

func (tapi *TeamAPI) getTeamMembershipUpdates(ctx context.Context, orgID, teamID int64, cmd team.SetTeamMembershipsCommand, signedInUser identity.Requester) ([]accesscontrol.SetResourcePermissionCommand, error) {
	adminEmails := make(map[string]struct{}, len(cmd.Admins))
	for _, admin := range cmd.Admins {
		adminEmails[admin] = struct{}{}
	}
	memberEmails := make(map[string]struct{}, len(cmd.Members))
	for _, member := range cmd.Members {
		memberEmails[member] = struct{}{}
	}

	currentMemberships, err := tapi.teamService.GetTeamMembers(ctx, &team.GetTeamMembersQuery{OrgID: orgID, TeamID: teamID, SignedInUser: signedInUser})
	if err != nil {
		return nil, err
	}
	membersToRemove := make([]int64, 0)
	for _, member := range currentMemberships {
		if _, ok := adminEmails[member.Email]; ok {
			if member.Permission == team.PermissionTypeAdmin {
				delete(adminEmails, member.Email)
			}
			continue
		}
		if _, ok := memberEmails[member.Email]; ok {
			if member.Permission == team.PermissionTypeMember {
				delete(memberEmails, member.Email)
			}
			continue
		}
		membersToRemove = append(membersToRemove, member.UserID)
	}

	adminIDs, err := tapi.getUserIDs(ctx, adminEmails)
	if err != nil {
		return nil, err
	}
	memberIDs, err := tapi.getUserIDs(ctx, memberEmails)
	if err != nil {
		return nil, err
	}

	teamMemberships := make([]accesscontrol.SetResourcePermissionCommand, 0, len(adminIDs)+len(memberIDs)+len(membersToRemove))
	for _, admin := range adminIDs {
		teamMemberships = append(teamMemberships, accesscontrol.SetResourcePermissionCommand{Permission: team.PermissionTypeAdmin.String(), UserID: admin})
	}
	for _, member := range memberIDs {
		teamMemberships = append(teamMemberships, accesscontrol.SetResourcePermissionCommand{Permission: team.PermissionTypeMember.String(), UserID: member})
	}
	for _, member := range membersToRemove {
		teamMemberships = append(teamMemberships, accesscontrol.SetResourcePermissionCommand{Permission: "", UserID: member})
	}

	return teamMemberships, nil
}

func (tapi *TeamAPI) getUserIDs(ctx context.Context, emails map[string]struct{}) ([]int64, error) {
	userIDs := make([]int64, 0, len(emails))
	for email := range emails {
		user, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			tapi.logger.Error("failed to find user", "email", email, "error", err)
			return nil, err
		}
		userIDs = append(userIDs, user.ID)
	}
	return userIDs, nil
}

// swagger:route DELETE /teams/{team_id}/members/{user_id} teams removeTeamMember
//
// Remove Member From Team.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (tapi *TeamAPI) removeTeamMember(c *contextmodel.ReqContext) response.Response {
	orgId := c.GetOrgID()
	teamId, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}
	userId, err := strconv.ParseInt(web.Params(c.Req)[":userId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "userId is invalid", err)
	}

	existingTeam, err := tapi.getTeamDTOByID(c, teamId)
	if err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, "Team not found", err)
		}

		return response.Error(http.StatusInternalServerError, "Failed to get Team", err)
	}

	isGroupSyncEnabled := tapi.cfg.Raw.Section("auth.scim").Key("group_sync_enabled").MustBool(false)
	if isGroupSyncEnabled && existingTeam.IsProvisioned {
		return response.Error(http.StatusBadRequest, "Team memberships cannot be updated for provisioned teams", err)
	}

	teamIDString := strconv.FormatInt(teamId, 10)
	if _, err := tapi.teamPermissionsService.SetUserPermission(c.Req.Context(), orgId, accesscontrol.User{ID: userId}, teamIDString, ""); err != nil {
		if errors.Is(err, team.ErrTeamNotFound) {
			return response.Error(http.StatusNotFound, "Team not found", nil)
		}

		if errors.Is(err, team.ErrTeamMemberNotFound) {
			return response.Error(http.StatusNotFound, "Team member not found", nil)
		}

		return response.Error(http.StatusInternalServerError, "Failed to remove Member from Team", err)
	}
	return response.Success("Team Member removed")
}

// addOrUpdateTeamMember adds or updates a team member.
//
// Stubbable by tests.
var addOrUpdateTeamMember = func(ctx context.Context, resourcePermissionService accesscontrol.TeamPermissionsService, userID, orgID, teamID int64, permission string) error {
	teamIDString := strconv.FormatInt(teamID, 10)
	if _, err := resourcePermissionService.SetUserPermission(ctx, orgID, accesscontrol.User{ID: userID}, teamIDString, permission); err != nil {
		return fmt.Errorf("failed setting permissions for user %d in team %d: %w", userID, teamID, err)
	}
	return nil
}

// swagger:parameters getTeamMembers
type GetTeamMembersParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters addTeamMember
type AddTeamMemberParams struct {
	// in:body
	// required:true
	Body team.AddTeamMemberCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters updateTeamMember
type UpdateTeamMemberParams struct {
	// in:body
	// required:true
	Body team.UpdateTeamMemberCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters setTeamMemberships
type SetTeamMembershipsParams struct {
	// in:body
	// required:true
	Body team.SetTeamMembershipsCommand `json:"body"`
	// in:path
	// required:true
	TeamID string `json:"team_id"`
}

// swagger:parameters removeTeamMember
type RemoveTeamMemberParams struct {
	// in:path
	// required:true
	TeamID string `json:"team_id"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:response getTeamMembersResponse
type GetTeamMembersResponse struct {
	// The response message
	// in: body
	Body []*team.TeamMemberDTO `json:"body"`
}

// setTeamMembershipsViaK8s updates team memberships using the TeamBinding K8s API
func (tapi *TeamAPI) setTeamMembershipsViaK8s(c *contextmodel.ReqContext) response.Response {
	ctx := c.Req.Context()

	cmd := team.SetTeamMembershipsCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	teamID, err := strconv.ParseInt(web.Params(c.Req)[":teamId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "teamId is invalid", err)
	}

	orgID := c.GetOrgID()
	namespace := fmt.Sprintf("org-%d", orgID)
	teamName := strconv.FormatInt(teamID, 10)

	// Validate the team
	resp := tapi.validateTeam(c, teamID, "Team memberships cannot be updated for provisioned teams")
	if resp != nil {
		return resp
	}

	// Build map of desired memberships
	adminEmails := make(map[string]struct{}, len(cmd.Admins))
	for _, admin := range cmd.Admins {
		adminEmails[admin] = struct{}{}
	}
	memberEmails := make(map[string]struct{}, len(cmd.Members))
	for _, member := range cmd.Members {
		memberEmails[member] = struct{}{}
	}

	// Get all existing TeamBindings for this team
	existingBindings, err := tapi.teamBindingClient.List(ctx, namespace, resource.ListOptions{
		FieldSelectors: []string{fmt.Sprintf("spec.teamRef.name=%s", teamName)},
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list existing team bindings", err)
	}

	// Track which bindings need to be updated vs deleted
	bindingsToUpdate := make(map[string]*iamv0alpha1.TeamBinding)
	bindingsToDelete := make([]*iamv0alpha1.TeamBinding, 0)

	// Process existing bindings
	for i := range existingBindings.Items {
		binding := &existingBindings.Items[i]

		// Get user by subject name (user ID)
		userID, err := strconv.ParseInt(binding.Spec.Subject.Name, 10, 64)
		if err != nil {
			tapi.logger.Warn("Invalid user ID in TeamBinding", "subject", binding.Spec.Subject.Name)
			continue
		}

		user, err := tapi.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
		if err != nil {
			tapi.logger.Warn("Failed to get user", "userID", userID, "error", err)
			continue
		}

		// Check if this user should be an admin
		if _, isAdmin := adminEmails[user.Email]; isAdmin {
			if binding.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionAdmin {
				// Update permission to admin
				binding.Spec.Permission = iamv0alpha1.TeamBindingTeamPermissionAdmin
				bindingsToUpdate[binding.Name] = binding
			}
			delete(adminEmails, user.Email)
			continue
		}

		// Check if this user should be a member
		if _, isMember := memberEmails[user.Email]; isMember {
			if binding.Spec.Permission != iamv0alpha1.TeamBindingTeamPermissionMember {
				// Update permission to member
				binding.Spec.Permission = iamv0alpha1.TeamBindingTeamPermissionMember
				bindingsToUpdate[binding.Name] = binding
			}
			delete(memberEmails, user.Email)
			continue
		}

		// User is not in the new list, mark for deletion
		bindingsToDelete = append(bindingsToDelete, binding)
	}

	// Update existing bindings
	for _, binding := range bindingsToUpdate {
		_, err := tapi.teamBindingClient.Update(ctx, binding, resource.UpdateOptions{})
		if err != nil {
			return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to update team binding for user %s", binding.Spec.Subject.Name), err)
		}
	}

	// Create new bindings for admins
	for email := range adminEmails {
		user, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			tapi.logger.Error("Failed to find user", "email", email, "error", err)
			return response.Error(http.StatusNotFound, fmt.Sprintf("User with email %s not found", email), err)
		}

		binding := &iamv0alpha1.TeamBinding{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0alpha1.GroupVersion.Identifier(),
				Kind:       "TeamBinding",
			},
			ObjectMeta: metav1.ObjectMeta{
				Namespace:    namespace,
				GenerateName: fmt.Sprintf("team-%s-user-%d-", teamName, user.ID),
			},
			Spec: iamv0alpha1.TeamBindingSpec{
				Subject: iamv0alpha1.TeamBindingspecSubject{
					Name: strconv.FormatInt(user.ID, 10),
				},
				TeamRef: iamv0alpha1.TeamBindingTeamRef{
					Name: teamName,
				},
				Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				External:   false,
			},
		}

		_, err = tapi.teamBindingClient.Create(ctx, binding, resource.CreateOptions{})
		if err != nil {
			return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to create team binding for user %s", email), err)
		}
	}

	// Create new bindings for members
	for email := range memberEmails {
		user, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			tapi.logger.Error("Failed to find user", "email", email, "error", err)
			return response.Error(http.StatusNotFound, fmt.Sprintf("User with email %s not found", email), err)
		}

		binding := &iamv0alpha1.TeamBinding{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0alpha1.GroupVersion.Identifier(),
				Kind:       "TeamBinding",
			},
			ObjectMeta: metav1.ObjectMeta{
				Namespace:    namespace,
				GenerateName: fmt.Sprintf("team-%s-user-%d-", teamName, user.ID),
			},
			Spec: iamv0alpha1.TeamBindingSpec{
				Subject: iamv0alpha1.TeamBindingspecSubject{
					Name: strconv.FormatInt(user.ID, 10),
				},
				TeamRef: iamv0alpha1.TeamBindingTeamRef{
					Name: teamName,
				},
				Permission: iamv0alpha1.TeamBindingTeamPermissionMember,
				External:   false,
			},
		}

		_, err = tapi.teamBindingClient.Create(ctx, binding, resource.CreateOptions{})
		if err != nil {
			return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to create team binding for user %s", email), err)
		}
	}

	// Delete bindings that are no longer needed
	for _, binding := range bindingsToDelete {
		err := tapi.teamBindingClient.Delete(ctx, resource.Identifier{
			Namespace: binding.Namespace,
			Name:      binding.Name,
		}, resource.DeleteOptions{})
		if err != nil {
			tapi.logger.Error("Failed to delete team binding", "name", binding.Name, "error", err)
			return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to delete team binding %s", binding.Name), err)
		}
	}

	return response.Success("Team memberships have been updated")
}
