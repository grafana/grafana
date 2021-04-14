package accesscontrol

import (
	"time"
)

type Role struct {
	Version     int64  `json:"version"`
	UID         string `json:"uid"`
	Name        string `json:"name"`
	Description string `json:"description"`

	Updated time.Time `json:"updated"`
	Created time.Time `json:"created"`
}

type RoleDTO struct {
	Version     int64        `json:"version"`
	UID         string       `json:"uid"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions,omitempty"`
}

type Permission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

type EvaluationResult struct {
	HasAccess bool
	Meta      interface{}
}

func (p RoleDTO) Role() Role {
	return Role{
		Name:        p.Name,
		Description: p.Description,
	}
}
