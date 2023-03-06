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

func (r RoleType) IsValid() bool {
	return r == RoleViewer || r == RoleAdmin || r == RoleEditor || r == RoleNone
}

func (r RoleType) Includes(other RoleType) bool {
	switch r {
	case RoleAdmin:
		return true
	case RoleEditor:
		return other != RoleAdmin
	case RoleViewer:
		return other == RoleNone || r == other
	case RoleNone: // exhaustive lint obligation
		return r == other
	}

	return r == other
}

func (r RoleType) Children() []RoleType {
	switch r {
	case RoleAdmin:
		return []RoleType{RoleEditor, RoleViewer, RoleNone}
	case RoleEditor:
		return []RoleType{RoleViewer, RoleNone}
	case RoleViewer:
		return []RoleType{RoleNone}
	case RoleNone: // exhaustive lint obligation
		return []RoleType{}
	}

	return nil
}

func (r RoleType) Parents() []RoleType {
	switch r {
	case RoleEditor:
		return []RoleType{RoleAdmin}
	case RoleViewer:
		return []RoleType{RoleEditor, RoleAdmin}
	case RoleNone:
		return []RoleType{RoleViewer, RoleEditor, RoleAdmin}
	default:
		return nil
	}
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
