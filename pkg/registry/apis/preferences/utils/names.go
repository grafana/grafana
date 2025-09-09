package utils

import "strings"

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
	Owner ResourceOwner // the resource owner
	Name  string        // the team|user name
}

func (o OwnerReference) AsName() string {
	if o.Name == "" || o.Owner == NamespaceResourceOwner {
		return string(o.Owner)
	}
	return string(o.Owner) + "-" + o.Name
}

func ParseOwnerFromName(name string) (OwnerReference, bool) {
	before, after, found := strings.Cut(name, "-")
	if found && len(after) > 0 {
		switch before {
		case "user":
			return OwnerReference{Owner: UserResourceOwner, Name: after}, true
		case "team":
			return OwnerReference{Owner: TeamResourceOwner, Name: after}, true
		}
	} else if name == "namespace" {
		return OwnerReference{Owner: NamespaceResourceOwner}, true
	}
	return OwnerReference{}, false
}
