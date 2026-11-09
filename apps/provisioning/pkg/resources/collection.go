package resources

import "strings"

// A collection is a set of API groups whose objects share one storage group: every data source
// plugin serves its own group, and every object is stored in datasource.grafana.app. A configured
// group names a collection by standing a wildcard where the member identifies itself; which
// members exist depends on what the instance has installed, so they cannot be configured by hand.
const (
	// CollectionWildcard stands for the part of a served group that identifies the member, and
	// may sit anywhere in the pattern.
	CollectionWildcard = "*"
	// CollectionPrefix introduces the dotted form, whose literal part is the collection group.
	CollectionPrefix = CollectionWildcard + "."
	// CollectionSeparator qualifies a collection that does not name the group its members are
	// stored under: *-app@plugins.grafana.app.
	CollectionSeparator = "@"
)

// IsCollection reports whether a configured group names a collection rather than a served group.
func IsCollection(group string) bool {
	return strings.Contains(group, CollectionWildcard)
}

// IsDottedCollection reports whether a collection's literal part is itself its storage group.
func IsDottedCollection(group string) bool {
	return strings.HasPrefix(group, CollectionPrefix) &&
		!strings.Contains(strings.TrimPrefix(group, CollectionPrefix), CollectionWildcard)
}

// CollectionGroup returns the group a configured entry's resources are stored under, which is what
// provisioning addresses a collection by: the qualifier, the literal part of the dotted form, or
// the group itself.
func CollectionGroup(configured string) string {
	if _, collection, ok := strings.Cut(configured, CollectionSeparator); ok {
		return collection
	}
	return strings.TrimPrefix(configured, CollectionPrefix)
}

// CoversGroup reports whether a served group is covered by a configured one: exactly, or as a
// member of the collection it names. The wildcard never stands for nothing, so
// *.datasource.grafana.app does not cover datasource.grafana.app itself.
func CoversGroup(configured, served string) bool {
	pattern, _, _ := strings.Cut(configured, CollectionSeparator)
	before, after, wildcard := strings.Cut(pattern, CollectionWildcard)
	if !wildcard {
		return pattern == served
	}
	return len(served) > len(before)+len(after) &&
		strings.HasPrefix(served, before) &&
		strings.HasSuffix(served, after)
}
