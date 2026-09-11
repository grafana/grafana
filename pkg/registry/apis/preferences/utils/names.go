package utils

import (
	"strings"
)

// +enum
type ResourceOwner string

const (
	// Used when there is a single resource for a given org|stack
	NamespaceResourceOwner ResourceOwner = "namespace"
	// Resource with a 1:1 user mapping
	UserResourceOwner ResourceOwner = "user"
	// Resource with a 1:1 team mapping
	TeamResourceOwner ResourceOwner = "team"
	// The name does not match user, team or namespace
	UnknownResourceOwner ResourceOwner = ""
)

type OwnerReference struct {
	Owner      ResourceOwner // the resource owner
	Identifier string        // the team|user name
}

func (o OwnerReference) AsName() string {
	if o.Identifier == "" || o.Owner == NamespaceResourceOwner {
		return string(o.Owner)
	}
	return string(o.Owner) + "-" + o.Identifier
}

func ParseOwnerFromName(name string) (OwnerReference, bool) {
	before, after, found := strings.Cut(name, "-")
	if found && len(after) > 0 {
		switch before {
		case "user":
			return OwnerReference{Owner: UserResourceOwner, Identifier: after}, true
		case "team":
			return OwnerReference{Owner: TeamResourceOwner, Identifier: after}, true
		}
	} else if name == "namespace" {
		return OwnerReference{Owner: NamespaceResourceOwner}, true
	}
	return OwnerReference{}, false
}

// UserOwner returns the resource owner reference for the signed-in user.
func UserOwner(userUID string) OwnerReference {
	return OwnerReference{
		Owner:      UserResourceOwner,
		Identifier: userUID,
	}
}

// TeamOwner returns the resource owner reference for the given team UID.
func TeamOwner(teamUID string) OwnerReference {
	return OwnerReference{
		Owner:      TeamResourceOwner,
		Identifier: teamUID,
	}
}

// NamespaceOwner returns the resource owner reference for org-wide preferences.
func NamespaceOwner() OwnerReference {
	return OwnerReference{Owner: NamespaceResourceOwner}
}
