package team

import (
	"fmt"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/team"
)

// mapTeamPermission translates a legacy team.PermissionType to the generated
// enum on the Team CRD. Any unknown variant panics so that adding a new
// permission upstream without updating this mapping fails loud at startup
// rather than silently collapsing the new value to "member".
func mapTeamPermission(p team.PermissionType) iamv0alpha1.TeamTeamPermission {
	switch p {
	case team.PermissionTypeAdmin:
		return iamv0alpha1.TeamTeamPermissionAdmin
	case team.PermissionTypeMember:
		return iamv0alpha1.TeamTeamPermissionMember
	default:
		panic(fmt.Sprintf("team: unhandled legacy PermissionType %d", p))
	}
}

// toLegacyPermission is the inverse of mapTeamPermission with the same
// unknown-variant panic guarantee.
func toLegacyPermission(p iamv0alpha1.TeamTeamPermission) team.PermissionType {
	switch p {
	case iamv0alpha1.TeamTeamPermissionAdmin:
		return team.PermissionTypeAdmin
	case iamv0alpha1.TeamTeamPermissionMember:
		return team.PermissionTypeMember
	default:
		panic(fmt.Sprintf("team: unhandled TeamTeamPermission %q", p))
	}
}

func mapToTeamMember(tm legacy.TeamMember) iamv0alpha1.TeamTeamMember {
	return iamv0alpha1.TeamTeamMember{
		Kind:       "User",
		Name:       tm.UserUID,
		Permission: mapTeamPermission(tm.Permission),
		External:   tm.External,
	}
}

type memberDiff struct {
	toAdd    []iamv0alpha1.TeamTeamMember
	toUpdate []memberUpdate
	toDelete []legacy.TeamMember
}

type memberUpdate struct {
	binding    legacy.TeamMember
	permission iamv0alpha1.TeamTeamPermission
}

func diffMembers(current []legacy.TeamMember, desired []iamv0alpha1.TeamTeamMember) (memberDiff, error) {
	var out memberDiff

	currentByUser := make(map[string]legacy.TeamMember, len(current))
	for _, tm := range current {
		currentByUser[tm.UserUID] = tm
	}

	desiredByUser := make(map[string]iamv0alpha1.TeamTeamMember, len(desired))
	for _, m := range desired {
		if _, dup := desiredByUser[m.Name]; dup {
			return memberDiff{}, fmt.Errorf("duplicate member %q in spec.members", m.Name)
		}
		desiredByUser[m.Name] = m
	}

	for _, want := range desired {
		have, exists := currentByUser[want.Name]
		if !exists {
			out.toAdd = append(out.toAdd, want)
			continue
		}
		if want.External != have.External {
			return memberDiff{}, fmt.Errorf("cannot change external flag for member %q", want.Name)
		}
		if mapTeamPermission(have.Permission) != want.Permission {
			out.toUpdate = append(out.toUpdate, memberUpdate{binding: have, permission: want.Permission})
		}
	}

	for _, have := range current {
		if _, exists := desiredByUser[have.UserUID]; !exists {
			out.toDelete = append(out.toDelete, have)
		}
	}

	return out, nil
}
