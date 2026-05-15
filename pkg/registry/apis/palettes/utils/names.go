package utils

import (
	"strings"

	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

// ParseOwnerWithSuffix splits the name format used by palettes:
//   - org-<slug>
//   - user-<uid>-<slug>
//   - team-<uid>-<slug>
func ParseOwnerWithSuffix(name string) (prefutils.OwnerReference, string, bool) {
	if slug, found := strings.CutPrefix(name, "org-"); found {
		if slug == "" {
			return prefutils.OwnerReference{}, "", false
		}
		return prefutils.NamespaceOwner(), slug, true
	}

	if rest, found := strings.CutPrefix(name, "user-"); found {
		uid, slug, ok := strings.Cut(rest, "-")
		if !ok || uid == "" || slug == "" {
			return prefutils.OwnerReference{}, "", false
		}
		return prefutils.UserOwner(uid), slug, true
	}

	if rest, found := strings.CutPrefix(name, "team-"); found {
		uid, slug, ok := strings.Cut(rest, "-")
		if !ok || uid == "" || slug == "" {
			return prefutils.OwnerReference{}, "", false
		}
		return prefutils.TeamOwner(uid), slug, true
	}

	return prefutils.OwnerReference{}, "", false
}

// BuildName creates the palette resource name for a given owner and slug.
func BuildName(owner prefutils.OwnerReference, slug string) string {
	switch owner.Owner {
	case prefutils.NamespaceResourceOwner:
		return "org-" + slug
	case prefutils.UserResourceOwner:
		return "user-" + owner.Identifier + "-" + slug
	case prefutils.TeamResourceOwner:
		return "team-" + owner.Identifier + "-" + slug
	default:
		return ""
	}
}
