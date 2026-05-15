package palettes

import (
	"context"
	"fmt"
	"slices"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"

	authlib "github.com/grafana/authlib/types"
	palettesapi "github.com/grafana/grafana/apps/palettes/pkg/apis/palettes/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	paletteutils "github.com/grafana/grafana/pkg/registry/apis/palettes/utils"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

// PalettesTeamLimit is the maximum number of team groups used when evaluating
// shareWith and team-owned palettes during List, mirroring PreferencesTeamLimit.
const PalettesTeamLimit = 25

// paletteStorage wraps registry storage so List returns only palettes the
// requester may read (owner or shareWith), except org admins who receive the
// unfiltered underlying list.
type paletteStorage struct {
	grafanarest.Storage
}

func (s *paletteStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if user.GetIdentityType() != authlib.TypeUser {
		return nil, fmt.Errorf("only users may list palettes")
	}
	if user.GetIdentifier() == "" {
		return nil, fmt.Errorf("user identifier is required")
	}
	if options != nil && options.Continue != "" {
		return nil, fmt.Errorf("continue token not supported")
	}
	if options != nil && options.LabelSelector != nil && !options.LabelSelector.Empty() {
		return nil, fmt.Errorf("labelSelector not supported")
	}

	raw, err := s.Storage.List(ctx, options)
	if err != nil {
		return nil, err
	}
	list, ok := raw.(*palettesapi.PaletteList)
	if !ok {
		return nil, fmt.Errorf("expected PaletteList, got %T", raw)
	}

	if user.GetOrgRole() == identity.RoleAdmin {
		return list, nil
	}

	teams := capTeams(user.GetGroups(), PalettesTeamLimit)
	myUID := user.GetIdentifier()
	out := &palettesapi.PaletteList{
		Items: make([]palettesapi.Palette, 0, len(list.Items)),
	}
	for i := range list.Items {
		if canRead(&list.Items[i], myUID, teams) {
			out.Items = append(out.Items, list.Items[i])
		}
	}
	return out, nil
}

func capTeams(groups []string, limit int) []string {
	teams := slices.Clone(groups)
	slices.Sort(teams)
	if len(teams) > limit {
		teams = teams[:limit]
	}
	return teams
}

func canRead(p *palettesapi.Palette, myUID string, myTeams []string) bool {
	owner, _, ok := paletteutils.ParseOwnerWithSuffix(p.Name)
	if !ok {
		return false
	}

	switch owner.Owner {
	case prefutils.NamespaceResourceOwner:
		return true
	case prefutils.UserResourceOwner:
		if owner.Identifier == myUID {
			return true
		}
	case prefutils.TeamResourceOwner:
		if slices.Contains(myTeams, owner.Identifier) {
			return true
		}
	}

	for _, sw := range p.Spec.ShareWith {
		if shareScopeAllows(string(sw), myUID, myTeams) {
			return true
		}
	}
	return false
}

func shareScopeAllows(scope string, myUID string, myTeams []string) bool {
	if scope == "org" {
		return true
	}
	ref, ok := prefutils.ParseOwnerFromName(scope)
	if !ok {
		return false
	}
	switch ref.Owner {
	case prefutils.UserResourceOwner:
		return ref.Identifier == myUID
	case prefutils.TeamResourceOwner:
		return slices.Contains(myTeams, ref.Identifier)
	case prefutils.NamespaceResourceOwner:
		return true
	default:
		return false
	}
}
