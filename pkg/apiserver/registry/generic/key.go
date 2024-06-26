package generic

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validation/path"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
)

type Key struct {
	Group     string
	Resource  string
	Namespace string
	Name      string
}

func ParseKey(key string) (*Key, error) {
	// /<group>/<resource>[/namespaces/<namespace>][/<name>]
	parts := strings.Split(key, "/")
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid key (expecting at least 2 parts): %s", key)
	}

	if parts[0] != "" {
		return nil, fmt.Errorf("invalid key (expecting leading slash): %s", key)
	}

	k := &Key{
		Group:    parts[1],
		Resource: parts[2],
	}

	if len(parts) == 3 {
		return k, nil
	}

	if parts[3] != "namespaces" {
		k.Name = parts[3]
		return k, nil
	}

	if len(parts) < 5 {
		return nil, fmt.Errorf("invalid key (expecting namespace after 'namespaces'): %s", key)
	}

	k.Namespace = parts[4]

	if len(parts) == 5 {
		return k, nil
	}

	k.Name = parts[5]

	return k, nil
}

func (k *Key) String() string {
	s := "/" + k.Group + "/" + k.Resource
	if len(k.Namespace) > 0 {
		s += "/namespaces/" + k.Namespace
	}
	if len(k.Name) > 0 {
		s += "/" + k.Name
	}
	return s
}

func (k *Key) IsEqual(other *Key) bool {
	return k.Group == other.Group &&
		k.Resource == other.Resource &&
		k.Namespace == other.Namespace &&
		k.Name == other.Name
}

// KeyRootFunc is used by the generic registry store to construct the first portion of the storage key.
func KeyRootFunc(gr schema.GroupResource) func(ctx context.Context) string {
	return func(ctx context.Context) string {
		ns, _ := genericapirequest.NamespaceFrom(ctx)
		key := &Key{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: ns,
		}
		return key.String()
	}
}

// NamespaceKeyFunc is the default function for constructing storage paths to
// a resource relative to the given prefix enforcing namespace rules. If the
// context does not contain a namespace, it errors.
func NamespaceKeyFunc(gr schema.GroupResource) func(ctx context.Context, name string) (string, error) {
	return func(ctx context.Context, name string) (string, error) {
		ns, ok := genericapirequest.NamespaceFrom(ctx)
		if !ok || len(ns) == 0 {
			return "", apierrors.NewBadRequest("Namespace parameter required.")
		}
		if len(name) == 0 {
			return "", apierrors.NewBadRequest("Name parameter required.")
		}
		if msgs := path.IsValidPathSegmentName(name); len(msgs) != 0 {
			return "", apierrors.NewBadRequest(fmt.Sprintf("Name parameter invalid: %q: %s", name, strings.Join(msgs, ";")))
		}
		key := &Key{
			Group:     gr.Group,
			Resource:  gr.Resource,
			Namespace: ns,
			Name:      name,
		}
		return key.String(), nil
	}
}

// NoNamespaceKeyFunc is the default function for constructing storage paths
// to a resource relative to the given prefix without a namespace.
func NoNamespaceKeyFunc(ctx context.Context, prefix string, gr schema.GroupResource, name string) (string, error) {
	if len(name) == 0 {
		return "", apierrors.NewBadRequest("Name parameter required.")
	}
	if msgs := path.IsValidPathSegmentName(name); len(msgs) != 0 {
		return "", apierrors.NewBadRequest(fmt.Sprintf("Name parameter invalid: %q: %s", name, strings.Join(msgs, ";")))
	}
	key := &Key{
		Group:    gr.Group,
		Resource: gr.Resource,
		Name:     name,
	}
	return prefix + key.String(), nil
}
