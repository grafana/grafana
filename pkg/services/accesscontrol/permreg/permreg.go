package permreg

import (
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	// ErrInvalidScope is returned when the scope is not valid for the action
	ErrInvalidScopeTplt = "invalid scope: {{.Public.Scope}}, for action: {{.Public.Action}}, expected prefixes are {{.Public.ValidScopesFormat}}"
	ErrBaseInvalidScope = errutil.BadRequest("permreg.invalid-scope").MustTemplate(ErrInvalidScopeTplt, errutil.WithPublic(ErrInvalidScopeTplt))

	ErrUnknownActionTplt = "unknown action: {{.Public.Action}}, was not found in the list of valid actions"
	ErrBaseUnknownAction = errutil.BadRequest("permreg.unknown-action").MustTemplate(ErrUnknownActionTplt, errutil.WithPublic(ErrUnknownActionTplt))

	ErrBaseUnknownKind = errutil.BadRequest("permreg.unknown-kind").MustTemplate("unknown kind: {{.Public.Kind}}")
)

func ErrInvalidScope(scope string, action string, validScopePrefixes PrefixSet) error {
	if len(validScopePrefixes) == 0 {
		return ErrBaseInvalidScope.Build(errutil.TemplateData{Public: map[string]any{"Scope": scope, "Action": action, "ValidScopesFormat": "[none]"}})
	}
	formats := generateValidScopeFormats(validScopePrefixes)
	return ErrBaseInvalidScope.Build(errutil.TemplateData{Public: map[string]any{"Scope": scope, "Action": action, "ValidScopesFormat": formats}})
}

func ErrUnknownAction(action string) error {
	return ErrBaseUnknownAction.Build(errutil.TemplateData{Public: map[string]any{"Action": action}})
}

func ErrUnknownKind(kind string) error {
	return ErrBaseUnknownKind.Build(errutil.TemplateData{Public: map[string]any{"Kind": kind}})
}

func generateValidScopeFormats(acceptedScopePrefixes PrefixSet) []string {
	if len(acceptedScopePrefixes) == 0 {
		return []string{}
	}
	acceptedPrefixesList := make([]string, 0, 10)
	acceptedPrefixesList = append(acceptedPrefixesList, "*")
	for prefix := range acceptedScopePrefixes {
		parts := strings.Split(prefix, ":")
		// If the prefix has an attribute part add the intermediate format kind:*
		if len(parts) > 2 {
			acceptedPrefixesList = append(acceptedPrefixesList, parts[0]+":*")
		}
		// Add the most specific format kind:attribute:*
		acceptedPrefixesList = append(acceptedPrefixesList, prefix+"*")
	}
	return acceptedPrefixesList
}

type PermissionRegistry interface {
	RegisterPluginScope(scope string)
	RegisterPermission(action, scope string) error
	IsPermissionValid(action, scope string) error
	GetScopePrefixes(action string) (PrefixSet, bool)
}

type PrefixSet map[string]bool

var _ PermissionRegistry = &permissionRegistry{}

type permissionRegistry struct {
	actionScopePrefixes map[string]PrefixSet // TODO use thread safe map
	kindScopePrefix     map[string]string
	logger              log.Logger
}

func ProvidePermissionRegistry() PermissionRegistry {
	return newPermissionRegistry()
}

func newPermissionRegistry() *permissionRegistry {
	// defaultKindScopes maps the most specific accepted scope prefix for a given kind (folders, dashboards, etc)
	defaultKindScopes := map[string]string{
		"teams":               "teams:id:",
		"users":               "users:id:",
		"datasources":         "datasources:uid:",
		"dashboards":          "dashboards:uid:",
		"folders":             "folders:uid:",
		"annotations":         "annotations:type:",
		"orgs":                "orgs:id:",
		"plugins":             "plugins:id:",
		"provisioners":        "provisioners:",
		"reports":             "reports:id:",
		"permissions":         "permissions:type:",
		"serviceaccounts":     "serviceaccounts:id:",
		"settings":            "settings:",
		"global.users":        "global.users:id:",
		"roles":               "roles:uid:",
		"services":            "services:",
		"receivers":           "receivers:uid:",
		"secret.securevalues": "secret.securevalues:uid:",
		"secret.keepers":      "secret.keepers:uid:",
	}
	return &permissionRegistry{
		actionScopePrefixes: make(map[string]PrefixSet, 200),
		kindScopePrefix:     defaultKindScopes,
		logger:              log.New("accesscontrol.permreg"),
	}
}

func (pr *permissionRegistry) RegisterPluginScope(scope string) {
	if scope == "" {
		return
	}

	scopeParts := strings.Split(scope, ":")
	kind := scopeParts[0]

	// If the scope is already registered, return
	if _, found := pr.kindScopePrefix[kind]; found {
		return
	}

	// If the scope contains an attribute part, register the kind and attribute
	if len(scopeParts) > 2 {
		attr := scopeParts[1]
		pr.kindScopePrefix[kind] = kind + ":" + attr + ":"
		pr.logger.Debug("registered scope prefix", "kind", kind, "scope_prefix", kind+":"+attr+":")
		return
	}

	pr.logger.Debug("registered scope prefix", "kind", kind, "scope_prefix", kind+":")
	pr.kindScopePrefix[kind] = kind + ":"
}

func (pr *permissionRegistry) RegisterPermission(action, scope string) error {
	if _, ok := pr.actionScopePrefixes[action]; !ok {
		pr.actionScopePrefixes[action] = PrefixSet{}
	}

	if scope == "" {
		// scopeless action
		return nil
	}

	kind := strings.Split(scope, ":")[0]
	scopePrefix, ok := pr.kindScopePrefix[kind]
	if !ok {
		pr.logger.Error("unknown kind: please update `kindScopePrefix` with the correct scope prefix", "kind", kind)
		return ErrUnknownKind(kind)
	}

	// Add a new entry in case the scope is not empty
	pr.actionScopePrefixes[action][scopePrefix] = true
	return nil
}

func (pr *permissionRegistry) IsPermissionValid(action, scope string) error {
	validScopePrefixes, ok := pr.actionScopePrefixes[action]
	if !ok {
		return ErrUnknownAction(action)
	}

	if ok && len(validScopePrefixes) == 0 {
		// Expecting action without any scope
		if scope != "" {
			return ErrInvalidScope(scope, action, nil)
		}
		return nil
	}

	if !isScopeValid(scope, validScopePrefixes) {
		return ErrInvalidScope(scope, action, validScopePrefixes)
	}
	return nil
}

func isScopeValid(scope string, validScopePrefixes PrefixSet) bool {
	// Super wildcard scope
	if scope == "*" {
		return true
	}
	for scopePrefix := range validScopePrefixes {
		// Correct scope prefix
		if strings.HasPrefix(scope, scopePrefix) {
			return true
		}
		// Scope is wildcard of the correct prefix
		if strings.HasSuffix(scope, ":*") && strings.HasPrefix(scopePrefix, scope[:len(scope)-2]) {
			return true
		}
	}
	return false
}

func (pr *permissionRegistry) GetScopePrefixes(action string) (PrefixSet, bool) {
	set, ok := pr.actionScopePrefixes[action]
	return set, ok
}
