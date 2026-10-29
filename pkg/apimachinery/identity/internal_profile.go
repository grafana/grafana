package identity

import (
	"maps"
	"slices"

	"github.com/grafana/authlib/types"
)

type InternalIdentityProfile string

const (
	InternalIdentityService      InternalIdentityProfile = serviceName
	InternalIdentityProvisioning InternalIdentityProfile = serviceNameForProvisioning
)

func (p InternalIdentityProfile) String() string {
	return string(p)
}

// InternalIdentityProfileFor only recognizes requesters constructed here. A
// token or a manually constructed requester with the same UID is not proof of
// an internal identity. Modified grants must not be restored by profile loading.
func InternalIdentityProfileFor(requester Requester) (InternalIdentityProfile, bool) {
	r, ok := requester.(*StaticRequester)
	if !ok || r == nil {
		return "", false
	}

	if r.Type != types.TypeAccessPolicy ||
		r.UserUID != r.internalIdentityProfile.String() ||
		r.OrgRole != RoleAdmin ||
		!r.IsGrafanaAdmin {
		return "", false
	}

	permissions, ok := internalIdentityPermissions(r.internalIdentityProfile)
	if !ok || !maps.EqualFunc(r.GetPermissions(), permissions, slices.Equal[[]string]) {
		return "", false
	}

	return r.internalIdentityProfile, true
}

// InternalIdentityPermissions returns an independent copy; callers must validate
// the authority to assert a profile before using its grants for authorization.
func InternalIdentityPermissions(profile InternalIdentityProfile) (map[string][]string, bool) {
	permissions, ok := internalIdentityPermissions(profile)
	if !ok {
		return nil, false
	}

	return cloneInternalIdentityPermissions(permissions), true
}

func internalIdentityPermissions(profile InternalIdentityProfile) (map[string][]string, bool) {
	switch profile {
	case InternalIdentityService, InternalIdentityProvisioning:
		return serviceIdentityPermissions, true
	default:
		return nil, false
	}
}

func cloneServiceIdentityPermissions() map[string][]string {
	return cloneInternalIdentityPermissions(serviceIdentityPermissions)
}

func cloneInternalIdentityPermissions(grants map[string][]string) map[string][]string {
	permissions := make(map[string][]string, len(grants))
	for action, scopes := range grants {
		permissions[action] = slices.Clone(scopes)
	}

	return permissions
}
