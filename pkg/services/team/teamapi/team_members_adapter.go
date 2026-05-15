package teamapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/util/retry"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/team/teamapi")

const subjectKindUser = "User"

//go:generate mockery --name teamClientFactory --structname MockTeamClientFactory --inpackage --filename team_client_factory_mock.go
type teamClientFactory interface {
	GetClient(c *contextmodel.ReqContext) (*iamv0alpha1.TeamClient, error)
}

type directRestConfigClientFactory struct {
	clientConfigProvider apiserver.DirectRestConfigProvider
}

func (f *directRestConfigClientFactory) GetClient(c *contextmodel.ReqContext) (*iamv0alpha1.TeamClient, error) {
	restConfig := f.clientConfigProvider.GetDirectRestConfig(c)
	if restConfig == nil {
		return nil, errors.New("rest config not available")
	}

	restConfig.APIPath = "apis"
	clientRegistry := k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())

	client, err := iamv0alpha1.NewTeamClientFromGenerator(clientRegistry)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource client for Team: %w", err)
	}

	return client, nil
}

// setTeamMembershipsViaK8s updates team memberships by writing to
// Team.Spec.Members, mirroring the legacy SQL "set complete list" contract:
// the caller's admin/member email lists are the complete desired set for User
// members. Any User member not in the request is removed (including external
// team-sync-owned members — team-sync will re-add them on the next
// reconciliation). External members in the request have their permission
// updated and the External flag preserved. Non-User entries (e.g.
// ServiceAccount) are always passed through unchanged.
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

	teamClient, err := tapi.teamClientFactory.GetClient(c)
	if err != nil {
		return response.Error(http.StatusServiceUnavailable, "Team service not available", err)
	}

	// Resolve emails → UIDs up-front. Fail before any K8s write if any email
	// can't be resolved. Admin wins on collision (same as the pre-K8s flow).
	desired, missing, err := tapi.resolveDesiredMembers(ctx, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to resolve users", err)
	}
	if len(missing) > 0 {
		return response.Error(http.StatusNotFound, fmt.Sprintf("users not found: %v", missing), nil)
	}

	// Read-modify-write on Team.Spec.Members. Team-sync reconciles members in
	// the background, so a 409 from a concurrent writer is expected; refresh
	// and retry.
	retryErr := retry.RetryOnConflict(retry.DefaultRetry, func() error {
		teamObj, err := teamClient.Get(ctx, resource.Identifier{
			Namespace: c.Namespace,
			Name:      teamDTO.UID,
		})
		if err != nil {
			return err
		}

		newMembers := rebuildSpecMembers(teamObj.Spec.Members, desired)
		if slices.Equal(teamObj.Spec.Members, newMembers) {
			return nil
		}
		teamObj.Spec.Members = newMembers

		_, err = teamClient.Update(ctx, teamObj, resource.UpdateOptions{})
		return err
	})
	if retryErr != nil {
		if k8serrors.IsNotFound(retryErr) {
			return response.Error(http.StatusNotFound, "Team not found", retryErr)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update team members", retryErr)
	}
	return response.Success("Team memberships have been updated")
}

// resolveDesiredMembers maps the caller's email lists to UIDs and the
// permission each UID should end up with. Admin wins over Member on collision.
// Returns the list of emails that couldn't be resolved so the caller can fail
// the whole request before any write.
func (tapi *TeamAPI) resolveDesiredMembers(
	ctx context.Context,
	cmd team.SetTeamMembershipsCommand,
) (map[string]iamv0alpha1.TeamTeamPermission, []string, error) {
	desired := make(map[string]iamv0alpha1.TeamTeamPermission, len(cmd.Admins)+len(cmd.Members))
	var missing []string

	apply := func(email string, perm iamv0alpha1.TeamTeamPermission) error {
		usr, err := tapi.userService.GetByEmail(ctx, &user.GetUserByEmailQuery{Email: email})
		if err != nil {
			if errors.Is(err, user.ErrUserNotFound) {
				missing = append(missing, email)
				return nil
			}
			return err
		}
		if existing, ok := desired[usr.UID]; ok && existing == iamv0alpha1.TeamTeamPermissionAdmin {
			return nil
		}
		desired[usr.UID] = perm
		return nil
	}

	for _, email := range cmd.Admins {
		if err := apply(email, iamv0alpha1.TeamTeamPermissionAdmin); err != nil {
			return nil, nil, err
		}
	}
	for _, email := range cmd.Members {
		if err := apply(email, iamv0alpha1.TeamTeamPermissionMember); err != nil {
			return nil, nil, err
		}
	}
	return desired, missing, nil
}

// rebuildSpecMembers applies the desired set to spec.members. User entries
// (including External team-sync-owned ones) are dropped if not in desired,
// and have their permission updated if they are — the External flag is
// preserved so the K8s representation continues to match what team-sync owns.
// Non-User entries are passed through untouched. Existing order is preserved
// for User entries that survive, so an idempotent request produces a slice
// equal to the input and the caller can skip the K8s Update via slices.Equal.
func rebuildSpecMembers(
	existing []iamv0alpha1.TeamTeamMember,
	desired map[string]iamv0alpha1.TeamTeamPermission,
) []iamv0alpha1.TeamTeamMember {
	applied := make(map[string]bool, len(desired))
	newMembers := make([]iamv0alpha1.TeamTeamMember, 0, len(existing)+len(desired))

	for _, m := range existing {
		if m.Kind != subjectKindUser {
			newMembers = append(newMembers, m)
			continue
		}
		if perm, ok := desired[m.Name]; ok {
			newMembers = append(newMembers, iamv0alpha1.TeamTeamMember{
				Kind:       subjectKindUser,
				Name:       m.Name,
				Permission: perm,
				External:   m.External,
			})
			applied[m.Name] = true
		}
	}
	// Sort the new (not-already-present) UIDs before appending so the resulting
	// slice is deterministic.
	newUIDs := make([]string, 0, len(desired))
	for uid := range desired {
		if applied[uid] {
			continue
		}
		newUIDs = append(newUIDs, uid)
	}
	sort.Strings(newUIDs)
	for _, uid := range newUIDs {
		newMembers = append(newMembers, iamv0alpha1.TeamTeamMember{
			Kind:       subjectKindUser,
			Name:       uid,
			Permission: desired[uid],
			External:   false,
		})
	}
	return newMembers
}
