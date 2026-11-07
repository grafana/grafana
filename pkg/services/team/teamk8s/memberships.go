package teamk8s

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/team"
)

// ReadUserTeamMemberships reads memberships through the teams API using an existing client.
// It runs as a namespace-scoped service identity so caller permissions cannot hide memberships.
// Offset pages can shift during concurrent membership changes, as with the teams search API.
// Background callers must supply a client whose transport supports calls without a web request.
func ReadUserTeamMemberships(ctx context.Context, client rest.Interface, namespace, userUID string, external bool) ([]team.UserTeamMembership, error) {
	if userUID == "" {
		return nil, errors.New("user UID is required")
	}
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, namespace)
	var uids []string
	seen := make(map[string]struct{})
	for page := 1; ; page++ {
		body, err := client.Get().
			AbsPath("apis", iamv0alpha1.APIGroup, iamv0alpha1.APIVersion, "namespaces", namespace, "searchTeams").
			Param("member", userUID).
			Param("limit", strconv.Itoa(common.DefaultListLimit)).
			Param("page", strconv.Itoa(page)).
			Do(ctx).Raw()
		if err != nil {
			return nil, fmt.Errorf("failed to search user teams: %w", err)
		}
		var result iamv0alpha1.GetSearchTeamsResponse
		if err := json.Unmarshal(body, &result); err != nil {
			return nil, fmt.Errorf("failed to decode team search: %w", err)
		}
		for _, hit := range result.Hits {
			if _, ok := seen[hit.Name]; !ok {
				seen[hit.Name] = struct{}{}
				uids = append(uids, hit.Name)
			}
		}
		// Member searches can report only the hits seen so far, so TotalHits is not a stopping condition.
		if len(result.Hits) < common.DefaultListLimit {
			break
		}
	}
	// Search indexes omit membership origin and permission, so read each matching team.
	teams := make([]*iamv0alpha1.Team, len(uids))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(usersGetParallelism)
	for i, uid := range uids {
		g.Go(func() error {
			body, err := client.Get().
				AbsPath("apis", iamv0alpha1.APIGroup, iamv0alpha1.APIVersion, "namespaces", namespace, "teams", uid).
				Do(gctx).Raw()
			if apierrors.IsNotFound(err) {
				return nil
			}
			if err != nil {
				return fmt.Errorf("failed to get team %s: %w", uid, err)
			}
			var obj iamv0alpha1.Team
			if err := json.Unmarshal(body, &obj); err != nil {
				return fmt.Errorf("failed to decode team %s: %w", uid, err)
			}
			teams[i] = &obj
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("failed to fetch user teams: %w", err)
	}
	memberships := make([]team.UserTeamMembership, 0, len(uids))
	for _, obj := range teams {
		// Teams and memberships may have been removed since the search.
		if obj == nil {
			continue
		}
		member, ok := findMemberInTeam(obj, userUID)
		if !ok || (external && !member.External) {
			continue
		}
		memberships = append(memberships, team.UserTeamMembership{
			TeamID:     deprecatedInternalID(obj),
			TeamUID:    obj.Name,
			External:   member.External,
			Permission: permissionFromMember(member.Permission),
		})
	}
	return memberships, nil
}
