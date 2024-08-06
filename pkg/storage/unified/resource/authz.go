package resource

import (
	context "context"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// Checks access while iterating within a resource
type AccessChecker func(namespace string, name string) bool

// Authorizer checks if a user is able to access a resource
// Functions return an ErrorResult when not accessible so that access details
// can be better communicated in the result
type Authorizer interface {
	CanCreate(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult
	CanUpdate(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult
	CanDelete(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult

	// Does not know about folder
	CanRead(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult

	// Check that the requester can read an item in the linked folder
	CanReadItemInFolder(ctx context.Context, id identity.Requester, resource string, folder string) *ErrorResult

	// The requester is allowed to write an item to a folder
	CanWriteToFolder(ctx context.Context, id identity.Requester, resource string, folder string) *ErrorResult

	// The requester is allowed to write an item to a folder
	CanWriteOrigin(ctx context.Context, id identity.Requester, origin string) *ErrorResult

	// Return an authz filter for a list request
	// NOTE the key must include a resource, but will likely not include a name
	// This will return an error if not allowed to read anything
	Compile(ctx context.Context, id identity.Requester, key *ResourceKey) (AccessChecker, *ErrorResult)
}

func NewAlwaysAuthorizer() Authorizer {
	return &constantAuthorizer{result: true}
}

func NewNeverAuthorizer() Authorizer {
	return &constantAuthorizer{result: true}
}

var (
	_ Authorizer = (*constantAuthorizer)(nil)
)

type constantAuthorizer struct {
	result bool
}

// CanCreate implements Authorizer.
func (c *constantAuthorizer) CanCreate(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not create"}
}

// CanDelete implements Authorizer.
func (c *constantAuthorizer) CanDelete(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not delete"}
}

// CanRead implements Authorizer.
func (c *constantAuthorizer) CanRead(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not read"}
}

// CanRead implements Authorizer.
func (c *constantAuthorizer) CanReadItemInFolder(ctx context.Context, id identity.Requester, resource string, folder string) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not read"}
}

// CanUpdate implements Authorizer.
func (c *constantAuthorizer) CanUpdate(ctx context.Context, id identity.Requester, key *ResourceKey) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not update"}
}

// ListFilter implements Authorizer.
func (c *constantAuthorizer) Compile(ctx context.Context, id identity.Requester, key *ResourceKey) (AccessChecker, *ErrorResult) {
	return func(namespace, name string) bool { return c.result }, nil
}

// CanWriteOrigin implements Authorizer.
func (c *constantAuthorizer) CanWriteOrigin(ctx context.Context, id identity.Requester, origin string) *ErrorResult {
	if c.result || origin == "UI" {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not write origin"}
}

// CanWriteToFolder implements Authorizer.
func (c *constantAuthorizer) CanWriteToFolder(ctx context.Context, id identity.Requester, resource string, folder string) *ErrorResult {
	if c.result {
		return nil
	}
	return &ErrorResult{Code: http.StatusForbidden, Message: "can not write folder"}
}
