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
	Group     string `json:"group,omitempty"`
	Resource  string `json:"resource"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name,omitempty"`
}

// ParseKey parses a key string into a Key.
// Format: [/group/<group>]/resource/<resource>[/namespace/<namespace>][/name/<name>]
func ParseKey(raw string) (*Key, error) {
	parts := strings.Split(raw, "/")
	key := &Key{}

	// Skip the first empty string
	if parts[0] == "" {
		parts = parts[1:]
	}

	for i := 0; i < len(parts); i += 2 {
		k := parts[i]
		if i+1 >= len(parts) {
			// Kube aggregator just appends the name to a key
			if key.Group != "" && key.Resource != "" && key.Namespace == "" && key.Name == "" {
				key.Name = k
				return key, nil
			}
			return nil, fmt.Errorf("invalid key: %s", raw)
		}
		v := parts[i+1]
		switch k {
		case "group":
			key.Group = v
		case "resource":
			key.Resource = v
		case "namespace":
			key.Namespace = v
		case "name":
			key.Name = v
		default:
			return nil, fmt.Errorf("invalid key part: %s", raw)
		}
	}

	if len(key.Resource) == 0 {
		return nil, fmt.Errorf("missing resource: %s", raw)
	}

	return key, nil
}

// String returns the string representation of the Key.
func (k *Key) String() string {
	var builder strings.Builder

	if len(k.Group) > 0 {
		builder.WriteString("/group/")
		builder.WriteString(k.Group)
	}
	if len(k.Resource) > 0 {
		builder.WriteString("/resource/")
		builder.WriteString(k.Resource)
	}
	if len(k.Namespace) > 0 {
		builder.WriteString("/namespace/")
		builder.WriteString(k.Namespace)
	}
	if len(k.Name) > 0 {
		builder.WriteString("/name/")
		builder.WriteString(k.Name)
	}

	return builder.String()
}

// IsEqual returns true if the keys are equal.
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
