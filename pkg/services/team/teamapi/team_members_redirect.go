package teamapi

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-app-sdk/resource"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// revertJob is a function that reverts a single operation as part of rollback
type revertJob func() error

// setTeamMembershipsViaK8s updates team memberships using the TeamBinding K8s API
func (tapi *TeamAPI) setTeamMembershipsViaK8s(
	c *contextmodel.ReqContext,
	teamID int64,
	cmd team.SetTeamMembershipsCommand,
) response.Response {
	var (
		ctx       = c.Req.Context()
		orgID     = c.GetOrgID()
		namespace = fmt.Sprintf("org-%d", orgID)
		teamName  = strconv.FormatInt(teamID, 10)
	)

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

	existingBindings, err := tapi.teamBindingClient.List(
		ctx,
		namespace, resource.ListOptions{
			FieldSelectors: []string{fmt.Sprintf("spec.teamRef.name=%s", teamName)},
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

	revertJobs := make(
		[]revertJob,
		0,
		len(bindingUpdates)+len(bindingsToDelete)+len(adminEmails)+len(memberEmails),
	)

	defer func() {
		if len(revertJobs) == 0 {
			return
		}

		tapi.logger.Warn("Error occurred during team membership update, attempting to revert changes", "teamID", teamID)
		for i := len(revertJobs) - 1; i >= 0; i-- {
			if err := revertJobs[i](); err != nil {
				tapi.logger.Error("Failed to revert operation during rollback", "error", err, "teamID", teamID)
			}
		}

		tapi.logger.Info("Rollback completed", "teamID", teamID, "revertedOperations", len(revertJobs))
	}()

	updateRevertJobs, err := tapi.updateTeamBindings(ctx, bindingUpdates)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update team bindings", err)
	}
	revertJobs = append(revertJobs, updateRevertJobs...)

	adminRevertJobs, err := tapi.createTeamBindingsForUsers(
		ctx,
		namespace,
		teamName,
		adminEmails,
		iamv0alpha1.TeamBindingTeamPermissionAdmin,
	)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create team bindings for admins", err)
	}
	revertJobs = append(revertJobs, adminRevertJobs...)

	memberRevertJobs, err := tapi.createTeamBindingsForUsers(
		ctx,
		namespace,
		teamName,
		memberEmails,
		iamv0alpha1.TeamBindingTeamPermissionMember,
	)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create team bindings for members", err)
	}
	revertJobs = append(revertJobs, memberRevertJobs...)

	deleteRevertJobs, err := tapi.deleteTeamBindings(ctx, bindingsToDelete)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete team bindings", err)
	}
	revertJobs = append(revertJobs, deleteRevertJobs...)

	return response.Success("Team memberships have been updated")
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

	// Validate all users exist
	var missingUsers []string
	for _, email := range allEmails {
		_, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			missingUsers = append(missingUsers, email)
		}
	}

	if len(missingUsers) > 0 {
		return fmt.Errorf("users not found: %v", missingUsers)
	}

	return nil
}

type bindingUpdate struct {
	original *iamv0alpha1.TeamBinding
	updated  *iamv0alpha1.TeamBinding
}

// processExistingBindings iterates through existing TeamBindings and determines which ones
// need to be updated or deleted based on the desired admin and member emails.
// It modifies adminEmails and memberEmails maps by removing processed entries.
func (tapi *TeamAPI) processExistingBindings(
	ctx context.Context,
	existingBindings *iamv0alpha1.TeamBindingList,
	adminEmails map[string]struct{},
	memberEmails map[string]struct{},
) (bindingUpdates []bindingUpdate, bindingsToDelete []iamv0alpha1.TeamBinding) {
	bindingUpdates = make([]bindingUpdate, 0)
	bindingsToDelete = make([]iamv0alpha1.TeamBinding, 0)

	for _, binding := range existingBindings.Items {
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

		if _, isAdmin := adminEmails[user.Email]; isAdmin {
			delete(adminEmails, user.Email)

			if binding.Spec.Permission == iamv0alpha1.TeamBindingTeamPermissionAdmin {
				continue
			}

			original := binding.DeepCopy()
			updated := binding.DeepCopy()
			updated.Spec.Permission = iamv0alpha1.TeamBindingTeamPermissionAdmin
			bindingUpdates = append(bindingUpdates, bindingUpdate{
				original: original,
				updated:  updated,
			})
			continue
		}

		// Check if this user should be a member
		if _, isMember := memberEmails[user.Email]; isMember {
			delete(memberEmails, user.Email)

			if binding.Spec.Permission == iamv0alpha1.TeamBindingTeamPermissionMember {
				continue
			}

			original := binding.DeepCopy()

			updated := binding.DeepCopy()
			updated.Spec.Permission = iamv0alpha1.TeamBindingTeamPermissionMember
			bindingUpdates = append(bindingUpdates, bindingUpdate{
				original: original,
				updated:  updated,
			})
		}

		bindingsToDelete = append(bindingsToDelete, binding)
	}

	return bindingUpdates, bindingsToDelete
}

// updateTeamBindings updates team bindings and returns revert jobs to restore the original state if rollback is needed
func (tapi *TeamAPI) updateTeamBindings(
	ctx context.Context,
	bindingUpdates []bindingUpdate,
) ([]revertJob, error) {
	revertJobs := make([]revertJob, 0, len(bindingUpdates))

	for _, update := range bindingUpdates {
		_, err := tapi.teamBindingClient.Update(ctx, update.updated, resource.UpdateOptions{})
		if err != nil {
			return revertJobs, fmt.Errorf("failed to update team binding for user %s: %w", update.updated.Spec.Subject.Name, err)
		}

		// Add revert job to restore original state
		originalBinding := update.original
		revertJobs = append(revertJobs, func() error {
			_, err := tapi.teamBindingClient.Update(ctx, originalBinding, resource.UpdateOptions{})
			return err
		})
	}

	return revertJobs, nil
}

// createTeamBindingsForUsers creates team bindings and returns revert jobs
// for each successful creation to ensure we can roll back even if the function fails partway through
func (tapi *TeamAPI) createTeamBindingsForUsers(
	ctx context.Context,
	namespace string,
	teamName string,
	userEmails map[string]struct{},
	permission iamv0alpha1.TeamBindingTeamPermission,
) ([]revertJob, error) {
	revertJobs := make([]revertJob, 0, len(userEmails))

	for email := range userEmails {
		user, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			return revertJobs, fmt.Errorf("user with email %s not found: %w", email, err)
		}

		binding := &iamv0alpha1.TeamBinding{
			TypeMeta: metav1.TypeMeta{
				APIVersion: iamv0alpha1.GroupVersion.Identifier(),
				Kind:       "TeamBinding",
			},
			ObjectMeta: metav1.ObjectMeta{
				Namespace: namespace,
				Name:      fmt.Sprintf("tb-%s-%d", teamName, user.ID),
			},
			Spec: iamv0alpha1.TeamBindingSpec{
				Subject: iamv0alpha1.TeamBindingspecSubject{
					Name: strconv.FormatInt(user.ID, 10),
				},
				TeamRef: iamv0alpha1.TeamBindingTeamRef{
					Name: teamName,
				},
				Permission: permission,
				External:   false,
			},
		}

		created, err := tapi.teamBindingClient.Create(ctx, binding, resource.CreateOptions{})
		if err != nil {
			return revertJobs, fmt.Errorf("create team binding for user %s: %w", email, err)
		}

		bindingName := created.Name
		bindingNamespace := created.Namespace
		revertJobs = append(revertJobs, func() error {
			return tapi.teamBindingClient.Delete(
				ctx, resource.Identifier{
					Namespace: bindingNamespace,
					Name:      bindingName,
				}, resource.DeleteOptions{},
			)
		})
	}

	return revertJobs, nil
}

func (tapi *TeamAPI) deleteTeamBindings(
	ctx context.Context,
	bindingsToDelete []iamv0alpha1.TeamBinding,
) ([]revertJob, error) {
	revertJobs := make([]revertJob, 0, len(bindingsToDelete))

	for _, binding := range bindingsToDelete {
		bindingToRestore := binding.DeepCopy()

		err := tapi.teamBindingClient.Delete(ctx, resource.Identifier{
			Namespace: binding.Namespace,
			Name:      binding.Name,
		}, resource.DeleteOptions{})
		if err != nil {
			return revertJobs, fmt.Errorf("failed to delete team binding %s: %w", binding.Name, err)
		}

		revertJobs = append(revertJobs, func() error {
			_, err := tapi.teamBindingClient.Create(ctx, bindingToRestore, resource.CreateOptions{})
			return err
		})
	}

	return revertJobs, nil
}
