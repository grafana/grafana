package roletype

import (
	"fmt"
	"strings"
)

// swagger:enum RoleType
type RoleType string

const (
	RoleNone   RoleType = "None"
	RoleViewer RoleType = "Viewer"
	RoleEditor RoleType = "Editor"
	RoleAdmin  RoleType = "Admin"
)

var rolePrecedence = map[RoleType]int{
	RoleNone:   10,
	RoleViewer: 20,
	RoleEditor: 30,
	RoleAdmin:  40,
}

// Needed to keep stable order
var roleOrder = [...]RoleType{
	RoleNone,
	RoleViewer,
	RoleEditor,
	RoleAdmin,
}

func (r RoleType) IsValid() bool {
	_, ok := rolePrecedence[r]
	return ok
}

func (r RoleType) Includes(other RoleType) bool {
	return rolePrecedence[r] >= rolePrecedence[other]
}

func (r RoleType) Children() []RoleType {
	children := make([]RoleType, 0, 3)

	for _, role := range roleOrder {
		if rolePrecedence[r] > rolePrecedence[role] {
			children = append(children, role)
		}
	}

	return children
}

func (r RoleType) Parents() []RoleType {
	parents := make([]RoleType, 0, 3)

	for _, role := range roleOrder {
		if rolePrecedence[r] < rolePrecedence[role] {
			parents = append(parents, role)
		}
	}

	return parents
}

func (r *RoleType) UnmarshalText(data []byte) error {
	// make sure "viewer" and "Viewer" are both correct
	str := strings.Title(string(data))

	*r = RoleType(str)
	if !r.IsValid() {
		if (*r) != "" {
			return fmt.Errorf("invalid role value: %s", *r)
		}

		*r = RoleViewer
	}

	return nil
}
