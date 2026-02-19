package teamapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/team/teamapi")

//go:generate mockery --name teamBindingClientFactory --structname MockTeamBindingClientFactory --inpackage --filename team_binding_client_factory_mock.go
type teamBindingClientFactory interface {
	GetClient(c *contextmodel.ReqContext) (*iamv0alpha1.TeamBindingClient, error)
}

type directRestConfigClientFactory struct {
	clientConfigProvider apiserver.DirectRestConfigProvider
}

func (f *directRestConfigClientFactory) GetClient(c *contextmodel.ReqContext) (*iamv0alpha1.TeamBindingClient, error) {
	restConfig := f.clientConfigProvider.GetDirectRestConfig(c)
	if restConfig == nil {
		return nil, errors.New("rest config not available")
	}

	restConfig.APIPath = "apis"
	clientRegistry := k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())

	client, err := iamv0alpha1.NewTeamBindingClientFromGenerator(clientRegistry)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource client for TeamBinding: %w", err)
	}

	return client, nil
}

// setTeamMembershipsViaK8s updates team memberships using the TeamBinding K8s API
func (tapi *TeamAPI) setTeamMembershipsViaK8s(
	c *contextmodel.ReqContext,
	teamID int64,
	cmd team.SetTeamMembershipsCommand,
) response.Response {
	ctx := c.Req.Context()
	ctx, span := tracer.Start(ctx, "setTeamMembershipsViaK8s", trace.WithAttributes(
		attribute.Int64("team_id", teamID),
		attribute.String("namespace", c.Namespace),
		attribute.Int("admin_count", len(cmd.Admins)),
		attribute.Int("member_count", len(cmd.Members)),
	))
	defer span.End()

	teamDTO, err := tapi.teamService.GetTeamByID(ctx, &team.GetTeamByIDQuery{
		OrgID: c.GetOrgID(),
		ID:    teamID,
	})
	if err != nil {
		return response.Error(http.StatusNotFound, "Team not found", err)
	}

	var (
		namespace = c.Namespace
		teamUID   = teamDTO.UID
	)

	teamBindingClient, err := tapi.teamBindingClientFactory.GetClient(c)
	if err != nil {
		return response.Error(http.StatusServiceUnavailable, "Team binding service not available", err)
	}

	adminEmails := make(map[string]struct{}, len(cmd.Admins))
	for _, admin := range cmd.Admins {
		adminEmails[admin] = struct{}{}
	}
	memberEmails := make(map[string]struct{}, len(cmd.Members))
	for _, member := range cmd.Members {
		memberEmails[member] = struct{}{}
	}

	if err := tapi.validateUsersExist(ctx, adminEmails, memberEmails); err != nil {
		return response.Error(http.StatusNotFound, "User validation failed", err)
	}

	existingBindings, err := teamBindingClient.List(
		ctx,
		namespace,
		resource.ListOptions{
			FieldSelectors: []string{fmt.Sprintf("spec.teamRef.name=%s", teamUID)},
		})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list existing team bindings", err)
	}

	bindingUpdates, bindingsToDelete := tapi.processExistingBindings(
		ctx,
		existingBindings,
		adminEmails,
		memberEmails,
	)

	if err := tapi.updateTeamBindings(ctx, teamBindingClient, bindingUpdates); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update team bindings", err)
	}

	if err := tapi.createTeamBindingsForUsers(
		ctx,
		teamBindingClient,
		namespace,
		teamUID,
		adminEmails,
		iamv0alpha1.TeamBindingTeamPermissionAdmin,
	); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create team bindings for admins", err)
	}

	if err := tapi.createTeamBindingsForUsers(
		ctx,
		teamBindingClient,
		namespace,
		teamUID,
		memberEmails,
		iamv0alpha1.TeamBindingTeamPermissionMember,
	); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create team bindings for members", err)
	}

	if err := tapi.deleteTeamBindings(ctx, teamBindingClient, bindingsToDelete); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete team bindings", err)
	}

	return response.Success("Team memberships have been updated")
}

// checkAndCreateBindingUpdate checks if a binding needs to be updated to a target permission.
// Returns: (wasFound, updatedBinding, needsUpdate)
// - wasFound: whether the email was in the map
// - updatedBinding: the update to apply (only valid if needsUpdate is true)
func checkAndCreateBindingUpdate(
	binding iamv0alpha1.TeamBinding,
	userEmail string,
	emailsMap map[string]struct{},
	targetPermission iamv0alpha1.TeamBindingTeamPermission,
) (bool, *iamv0alpha1.TeamBinding) {
	if _, exists := emailsMap[userEmail]; !exists {
		return false, nil
	}

	delete(emailsMap, userEmail)

	if binding.Spec.Permission == targetPermission {
		return true, nil
	}

	updated := binding.DeepCopy()
	updated.Spec.Permission = targetPermission

	return true, updated
}

// processExistingBindings iterates through existing TeamBindings and determines which ones
// need to be updated or deleted based on the desired admin and member emails.
// It modifies adminEmails and memberEmails maps by removing processed entries.
func (tapi *TeamAPI) processExistingBindings(
	ctx context.Context,
	existingBindings *iamv0alpha1.TeamBindingList,
	adminEmails map[string]struct{},
	memberEmails map[string]struct{},
) ([]*iamv0alpha1.TeamBinding, []iamv0alpha1.TeamBinding) {
	var (
		bindingUpdates   = make([]*iamv0alpha1.TeamBinding, 0)
		bindingsToDelete = make([]iamv0alpha1.TeamBinding, 0)
	)

	for _, binding := range existingBindings.Items {
		usr, err := tapi.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: binding.Spec.Subject.Name})
		if err != nil {
			tapi.logger.Warn("Failed to get user", "userUID", binding.Spec.Subject.Name, "error", err)
			continue
		}

		wasAdmin, adminUpdate := checkAndCreateBindingUpdate(
			binding,
			usr.Email,
			adminEmails,
			iamv0alpha1.TeamBindingTeamPermissionAdmin,
		)
		if wasAdmin {
			if adminUpdate != nil {
				bindingUpdates = append(bindingUpdates, adminUpdate)
			}
			continue
		}

		wasMember, memberUpdate := checkAndCreateBindingUpdate(
			binding,
			usr.Email,
			memberEmails,
			iamv0alpha1.TeamBindingTeamPermissionMember,
		)
		if wasMember {
			if memberUpdate != nil {
				bindingUpdates = append(bindingUpdates, memberUpdate)
			}
			continue
		}

		// User is not in the new list, mark for deletion
		bindingsToDelete = append(bindingsToDelete, binding)
	}

	return bindingUpdates, bindingsToDelete
}

// updateTeamBindings updates team bindings
func (tapi *TeamAPI) updateTeamBindings(
	ctx context.Context,
	teamBindingClient *iamv0alpha1.TeamBindingClient,
	bindingUpdates []*iamv0alpha1.TeamBinding,
) error {
	for _, binding := range bindingUpdates {
		if _, err := teamBindingClient.Update(ctx, binding, resource.UpdateOptions{}); err != nil {
			return fmt.Errorf("update team binding for user %s: %w", binding.Spec.Subject.Name, err)
		}
	}

	return nil
}

// createTeamBindingsForUsers creates team bindings for the given users
func (tapi *TeamAPI) createTeamBindingsForUsers(
	ctx context.Context,
	teamBindingClient *iamv0alpha1.TeamBindingClient,
	namespace string,
	teamUID string,
	userEmails map[string]struct{},
	permission iamv0alpha1.TeamBindingTeamPermission,
) error {
	for email := range userEmails {
		user, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			return fmt.Errorf("user with email %s not found: %w", email, err)
		}

		binding := &iamv0alpha1.TeamBinding{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0alpha1.GroupVersion.Identifier(),
				Kind:       iamv0alpha1.TeamBindingKind().Kind(),
			},
			ObjectMeta: makeMetadata(namespace, user.UID, teamUID),
			Spec: iamv0alpha1.TeamBindingSpec{
				Subject: iamv0alpha1.TeamBindingspecSubject{
					Name: user.UID,
				},
				TeamRef: iamv0alpha1.TeamBindingTeamRef{
					Name: teamUID,
				},
				Permission: permission,
				External:   false,
			},
		}

		if _, err := teamBindingClient.Create(ctx, binding, resource.CreateOptions{}); err != nil {
			return fmt.Errorf("create team binding for user %s: %w", email, err)
		}
	}

	return nil
}

// deleteTeamBindings deletes the specified team bindings
func (tapi *TeamAPI) deleteTeamBindings(
	ctx context.Context,
	teamBindingClient *iamv0alpha1.TeamBindingClient,
	bindingsToDelete []iamv0alpha1.TeamBinding,
) error {
	for _, binding := range bindingsToDelete {
		if err := teamBindingClient.Delete(ctx, resource.Identifier{
			Namespace: binding.Namespace,
			Name:      binding.Name,
		}, resource.DeleteOptions{}); err != nil {
			return fmt.Errorf("delete team binding %s: %w", binding.Name, err)
		}
	}

	return nil
}

// validateUsersExist checks that all users in the provided email maps exist before making any changes.
// This provides fail-fast behavior to avoid partial updates.
func (tapi *TeamAPI) validateUsersExist(
	ctx context.Context,
	adminEmails map[string]struct{},
	memberEmails map[string]struct{},
) error {
	allEmails := make([]string, 0, len(adminEmails)+len(memberEmails))
	for email := range adminEmails {
		allEmails = append(allEmails, email)
	}
	for email := range memberEmails {
		allEmails = append(allEmails, email)
	}

	var missingUsers []string
	for _, email := range allEmails {
		if _, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email}); err != nil {
			missingUsers = append(missingUsers, email)
		}
	}

	if len(missingUsers) > 0 {
		return fmt.Errorf("users not found: %v", missingUsers)
	}

	return nil
}

func makeMetadata(namespace, userUID, teamUID string) metav1.ObjectMeta {
	return metav1.ObjectMeta{
		Name:      fmt.Sprintf("u.%s.%s", userUID, teamUID),
		Namespace: namespace,
	}
}
