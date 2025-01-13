package authorizer

import (
	"context"
	"errors"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/claims"
)

type FolderLookup = func(group, resource, namespace, name string) (string, error)

func NewResourceAuthorizer(c authz.AccessClient, lookup FolderLookup) authorizer.Authorizer {
	return ResourceAuthorizer{
		client: c,
		lookup: lookup,
	}
}

// ResourceAuthorizer is used to translate authorizer.Authorizer calls to claims.AccessClient calls
type ResourceAuthorizer struct {
	client authz.AccessClient
	lookup FolderLookup
}

func (r ResourceAuthorizer) Authorize(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	if !attr.IsResourceRequest() {
		return authorizer.DecisionNoOpinion, "", nil
	}

	ident, ok := claims.From(ctx)
	if !ok {
		return authorizer.DecisionDeny, "", errors.New("no identity found for request")
	}

	folder := ""
	if r.lookup != nil {
		var err error
		folder, err = r.lookup(
			attr.GetAPIGroup(),
			attr.GetResource(),
			attr.GetNamespace(),
			attr.GetName())

		if err != nil {
			return authorizer.DecisionDeny, "Error reading folder", err
		}
	}

	res, err := r.client.Check(ctx, ident, authz.CheckRequest{
		Verb:        attr.GetVerb(),
		Group:       attr.GetAPIGroup(),
		Resource:    attr.GetResource(),
		Namespace:   attr.GetNamespace(),
		Name:        attr.GetName(),
		Subresource: attr.GetSubresource(),
		Path:        attr.GetPath(),
		Folder:      folder,
	})

	if err != nil {
		return authorizer.DecisionDeny, "", err
	}

	if !res.Allowed {
		return authorizer.DecisionDeny, "unauthorized request", nil
	}

	return authorizer.DecisionAllow, "", nil
}
