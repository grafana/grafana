package accesscontrol

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	maxPrefixParts = 2
)

func ParseScopeID(scope string) (int64, error) {
	id, err := strconv.ParseInt(ScopeSuffix(scope), 10, 64)
	if err != nil {
		return 0, ErrInvalidScope
	}
	return id, nil
}

func ParseScopeUID(scope string) (string, error) {
	uid := ScopeSuffix(scope)
	if len(uid) == 0 {
		return "", ErrInvalidScope
	}
	return uid, nil
}

func ScopeSuffix(scope string) string {
	return scope[len(ScopePrefix(scope)):]
}

func GetResourceScope(resource string, resourceID string) string {
	return Scope(resource, "id", resourceID)
}

func GetResourceScopeUID(resource string, resourceID string) string {
	return Scope(resource, "uid", resourceID)
}

func GetResourceScopeName(resource string, resourceID string) string {
	return Scope(resource, "name", resourceID)
}

func GetResourceScopeType(resource string, typeName string) string {
	return Scope(resource, "type", typeName)
}

func GetResourceAllScope(resource string) string {
	return Scope(resource, "*")
}

func GetResourceAllIDScope(resource string) string {
	return Scope(resource, "id", "*")
}

// Scope builds scope from parts
// e.g. Scope("users", "*") return "users:*"
func Scope(parts ...string) string {
	b := strings.Builder{}
	for i, c := range parts {
		if i != 0 {
			b.WriteRune(':')
		}
		b.WriteString(c)
	}
	return b.String()
}

// Parameter returns injectable scope part, based on URL parameters.
// e.g. Scope("users", Parameter(":id")) or "users:" + Parameter(":id")
func Parameter(key string) string {
	return fmt.Sprintf(`{{ index .URLParams "%s" }}`, key)
}

// Field returns an injectable scope part for selected fields from the request's context available in accesscontrol.ScopeParams.
// e.g. Scope("orgs", Parameter("OrgID")) or "orgs:" + Parameter("OrgID")
func Field(key string) string {
	return fmt.Sprintf(`{{ .%s }}`, key)
}

// ScopePrefix returns the prefix associated to a given scope
// we assume prefixes are all in the form <resource>:<attribute>:<value>
// ex: "datasources:name:test" returns "datasources:name:"
func ScopePrefix(scope string) string {
	parts := strings.Split(scope, ":")
	// We assume prefixes don't have more than maxPrefixParts parts
	if len(parts) > maxPrefixParts {
		parts = append(parts[:maxPrefixParts], "")
	}
	return strings.Join(parts, ":")
}

// ScopeProvider provides methods that construct scopes
type ScopeProvider interface {
	GetResourceScope(resourceID string) string
	GetResourceScopeUID(resourceID string) string
	GetResourceScopeName(resourceID string) string
	GetResourceScopeType(typeName string) string
	GetResourceAllScope() string
	GetResourceAllIDScope() string
}

type scopeProviderImpl struct {
	root string
}

// NewScopeProvider creates a new ScopeProvider that is configured with specific root scope
func NewScopeProvider(root string) ScopeProvider {
	return &scopeProviderImpl{
		root: root,
	}
}

// GetResourceScope returns scope that has the format "<rootScope>:id:<resourceID>"
func (s scopeProviderImpl) GetResourceScope(resourceID string) string {
	return GetResourceScope(s.root, resourceID)
}

// GetResourceScopeUID returns scope that has the format "<rootScope>:uid:<resourceID>"
func (s scopeProviderImpl) GetResourceScopeUID(resourceID string) string {
	return GetResourceScopeUID(s.root, resourceID)
}

// GetResourceScopeName returns scope that has the format "<rootScope>:name:<resourceID>"
func (s scopeProviderImpl) GetResourceScopeName(resourceID string) string {
	return GetResourceScopeName(s.root, resourceID)
}

// GetResourceScopeType returns scope that has the format "<rootScope>:type:<typeName>"
func (s scopeProviderImpl) GetResourceScopeType(typeName string) string {
	return GetResourceScopeType(s.root, typeName)
}

// GetResourceAllScope returns scope that has the format "<rootScope>:*"
func (s scopeProviderImpl) GetResourceAllScope() string {
	return GetResourceAllScope(s.root)
}

// GetResourceAllIDScope returns scope that has the format "<rootScope>:id:*"
func (s scopeProviderImpl) GetResourceAllIDScope() string {
	return GetResourceAllIDScope(s.root)
}

// WildcardsFromPrefix generates valid wildcards from prefix
// datasource:uid: => "*", "datasource:*", "datasource:uid:*"
func WildcardsFromPrefix(prefix string) Wildcards {
	var b strings.Builder
	wildcards := Wildcards{"*"}
	parts := strings.Split(prefix, ":")
	for _, p := range parts {
		if p == "" {
			continue
		}
		b.WriteString(p)
		b.WriteRune(':')
		wildcards = append(wildcards, b.String()+"*")
	}
	return wildcards
}

type Wildcards []string

// Contains check if wildcards contains scope
func (wildcards Wildcards) Contains(scope string) bool {
	for _, w := range wildcards {
		if scope == w {
			return true
		}
	}
	return false
}
