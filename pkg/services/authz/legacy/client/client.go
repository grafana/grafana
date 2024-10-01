package client

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/grpc"
)

type CheckRequest struct {
	// Namespace is either `org-<id>` or `stacks-<id>`.
	Namespace string

	// Subject is the typed identity we want to perform a check for
	Subject string

	// Action to check access for
	Action string

	// Resource is ~Kind eg dashboards
	Resource string
	// Attribute used to store permission
	Attr string
	// Name is the identifier for the resource.
	// In grafana, this was historically called "UID", but in k8s, it is the name
	Name string

	// Contextuals are additional resource + name that should be checked.
	// E.g. for dashboards this can be the folder that a it belong to.
	Contextuals []Contextual
}

type CheckResponse struct {
	Allowed bool
}

type Contextual struct {
	// Resource is ~Kind eg dashboards
	Resource string
	// Attribute used to store permission
	Attr string
	// Name is the identifier for the resource.
	// In grafana, this was historically called "UID", but in k8s, it is the name
	Name string
}

type ListRequest struct {
	// Namespace is either `org-<id>` or `stacks-<id>`.
	Namespace string
	// Subject is the typed identity we want to perform a check for
	Subject string
	// Action to check access for
	Action string
	// Resource is ~Kind eg dashboards
	Resource string
	// Attribute used to store permission
	Attr string
}

// Checks access while iterating within a resource
type ItemChecker func(name string, extra ...Contextual) bool

// FIME: this is the "new" client interface?
type ReadClient interface {
	Check(ctx context.Context, r CheckRequest) (*CheckResponse, error)
	Checker(ctx context.Context, r ListRequest) (ItemChecker, error)
}

var _ ReadClient = (*Client)(nil)

func NewClient(cc grpc.ClientConnInterface) *Client {
	return &Client{
		inner: openfgav1.NewOpenFGAServiceClient(cc),
	}
}

type Client struct {
	inner openfgav1.OpenFGAServiceClient
}

func (c *Client) Check(ctx context.Context, r CheckRequest) (*CheckResponse, error) {
	var object string

	if r.Resource != "" && r.Attr != "" && r.Name != "" {
		object = formatObject(r.Resource, r.Attr, r.Name)
	}

	contextual := &openfgav1.ContextualTupleKeys{}
	for _, c := range r.Contextuals {
		contextual.TupleKeys = append(
			contextual.TupleKeys,
			&openfgav1.TupleKey{
				Object: formatObject(c.Resource, c.Attr, c.Name),
			},
		)
	}

	res, err := c.inner.Check(ctx, &openfgav1.CheckRequest{
		StoreId: r.Namespace,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.Subject,
			Relation: r.Action,
			Object:   object,
		},
		ContextualTuples: contextual,
	})

	if err != nil {
		return nil, err
	}

	return &CheckResponse{Allowed: res.Allowed}, nil
}

func (c *Client) Checker(ctx context.Context, r ListRequest) (ItemChecker, error) {
	res, err := c.inner.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:  r.Namespace,
		Relation: r.Action,
		User:     r.Subject,
	})

	if err != nil {
		return nil, err
	}

	check := newChecker(r.Action, res.Objects)
	return func(name string, extra ...Contextual) bool {
		scopes := make([]string, 0, len(extra)+1)
		scopes = append(scopes, formatObject(r.Resource, r.Attr, name))
		for _, c := range extra {
			scopes = append(scopes, formatObject(c.Resource, c.Attr, c.Name))
		}
		return check(scopes...)
	}, nil
}

func formatObject(resource, attr, name string) string {
	return fmt.Sprintf("%s:%s:%s", resource, attr, name)
}

// Duplicated from accesscontrol package
func newChecker(action string, scopes []string) func(scopes ...string) bool {
	lookup := make(map[string]bool, len(scopes))
	for i := range scopes {
		lookup[scopes[i]] = true
	}

	var checkedWildcards bool
	var hasWildcard bool

	return func(scopes ...string) bool {
		if !checkedWildcards {
			wildcards := wildcardsFromScopes(scopes...)
			for _, w := range wildcards {
				if _, ok := lookup[w]; ok {
					hasWildcard = true
					break
				}
			}
			checkedWildcards = true
		}

		if hasWildcard {
			return true
		}

		for _, s := range scopes {
			if lookup[s] {
				return true
			}
		}
		return false
	}
}

type Wildcards []string

func (wildcards Wildcards) Contains(scope string) bool {
	for _, w := range wildcards {
		if scope == w {
			return true
		}
	}
	return false
}

// wildcardsFromPrefixes generates valid wildcards from prefixes
// datasource:uid: => "*", "datasource:*", "datasource:uid:*"
func wildcardsFromPrefixes(prefixes []string) Wildcards {
	var b strings.Builder
	wildcards := Wildcards{"*"}
	for _, prefix := range prefixes {
		parts := strings.Split(prefix, ":")
		for _, p := range parts {
			if p == "" {
				continue
			}
			b.WriteString(p)
			b.WriteRune(':')
			wildcards = append(wildcards, b.String()+"*")
		}
		b.Reset()
	}
	return wildcards
}

func wildcardsFromScopes(scopes ...string) Wildcards {
	prefixes := make([]string, len(scopes))
	for _, scope := range scopes {
		prefixes = append(prefixes, scopePrefix(scope))
	}

	return wildcardsFromPrefixes(prefixes)
}

func scopePrefix(scope string) string {
	const maxPrefixParts = 2

	parts := strings.Split(scope, ":")
	// We assume prefixes don't have more than maxPrefixParts parts
	if len(parts) > maxPrefixParts {
		parts = append(parts[:maxPrefixParts], "")
	}
	return strings.Join(parts, ":")
}
