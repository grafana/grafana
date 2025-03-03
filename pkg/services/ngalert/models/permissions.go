package models

import (
	"maps"
	"slices"
)

// ReceiverPermission is a type for representing permission to perform a receiver action.
type ReceiverPermission string

const (
	ReceiverPermissionReadSecret ReceiverPermission = "secrets"
	ReceiverPermissionAdmin      ReceiverPermission = "admin"
	ReceiverPermissionWrite      ReceiverPermission = "write"
	ReceiverPermissionDelete     ReceiverPermission = "delete"
)

// ReceiverPermissions returns all possible silence permissions.
func ReceiverPermissions() []ReceiverPermission {
	return []ReceiverPermission{
		ReceiverPermissionReadSecret,
		ReceiverPermissionAdmin,
		ReceiverPermissionWrite,
		ReceiverPermissionDelete,
	}
}

// ReceiverPermissionSet represents a set of permissions for a receiver.
type ReceiverPermissionSet = PermissionSet[ReceiverPermission]

func NewReceiverPermissionSet() ReceiverPermissionSet {
	return NewPermissionSet(ReceiverPermissions())
}

// PermissionSet represents a set of permissions on a resource.
type PermissionSet[T ~string] struct {
	set map[T]bool
	all []T
}

func NewPermissionSet[T ~string](all []T) PermissionSet[T] {
	return PermissionSet[T]{
		set: make(map[T]bool),
		all: slices.Clone(all),
	}
}

// Clone returns a deep copy of the permission set.
func (p PermissionSet[T]) Clone() PermissionSet[T] {
	return PermissionSet[T]{
		set: maps.Clone(p.set),
		all: p.all,
	}
}

// AllSet returns true if all possible permissions are set.
func (p PermissionSet[T]) AllSet() bool {
	for _, permission := range p.all {
		if _, ok := p.set[permission]; !ok {
			return false
		}
	}
	return true
}

// Has returns true if the given permission is allowed in the set.
func (p PermissionSet[T]) Has(permission T) (bool, bool) {
	allowed, ok := p.set[permission]
	return allowed, ok
}

// Set sets the given permission to the given allowed state.
func (p PermissionSet[T]) Set(permission T, allowed bool) {
	p.set[permission] = allowed
}
