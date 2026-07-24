package zanzana

import (
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	TypeRBACAction     = "rbac_action"
	TypeRBACPermission = "rbac_permission"
	RelationGranted    = "granted"

	fallbackIDVersion = "v1"
)

type TranslationKind string

const (
	Native   TranslationKind = "native"
	Fallback TranslationKind = "fallback"
	Invalid  TranslationKind = "invalid"
)

type PermissionTranslation struct {
	Kind   TranslationKind
	Tuples []*openfgav1.TupleKey
}

// ClassifyPermission decides whether a legacy permission has an exact native
// representation or must use the generic RBAC model.
func ClassifyPermission(permission RolePermission) TranslationKind {
	if err := validateRolePermission(permission); err != nil {
		return Invalid
	}

	if len(nativePermissionTuples("role:classification#assignee", permission)) > 0 {
		return Native
	}
	return Fallback
}

// IsNativeAction reports whether at least one exact native translation exists
// for an action. It is used for scopeless checks, where a scope cannot be used
// to distinguish native and fallback representations.
func IsNativeAction(action string) bool {
	if action == "" {
		return false
	}
	if isRoleManagementAction(action) || isUserManagementAction(action) || isTeamManagementAction(action) {
		return true
	}
	for _, entry := range common.SupportedActions() {
		if entry.Action == action {
			return true
		}
	}
	return false
}

// TranslatePermission projects exactly one source model: native permissions
// emit only resource tuples, while unsupported permissions emit only generic
// RBAC tuples. Invalid source data is returned as an error so reconciliation
// cannot silently drop or broaden a grant.
func TranslatePermission(subject string, permission RolePermission) (PermissionTranslation, error) {
	if err := validateRolePermission(permission); err != nil {
		return PermissionTranslation{Kind: Invalid}, err
	}

	if tuples := nativePermissionTuples(subject, permission); len(tuples) > 0 {
		return PermissionTranslation{Kind: Native, Tuples: tuples}, nil
	}

	scope := permission.CanonicalScope()
	tuples := []*openfgav1.TupleKey{
		{
			User:     subject,
			Relation: RelationGranted,
			Object:   FallbackActionObject(permission.Action),
		},
	}
	if scope != "" {
		tuples = append(tuples, &openfgav1.TupleKey{
			User:     subject,
			Relation: RelationGranted,
			Object:   FallbackPermissionObject(permission.Action, scope),
		})
	}

	return PermissionTranslation{Kind: Fallback, Tuples: tuples}, nil
}

func validateRolePermission(permission RolePermission) error {
	if permission.Action == "" || strings.TrimSpace(permission.Action) != permission.Action {
		return errors.New("RBAC action must not be empty or contain surrounding whitespace")
	}
	if strings.ContainsAny(permission.Action, "\x00\r\n") {
		return fmt.Errorf("invalid RBAC action %q", permission.Action)
	}

	scope := permission.CanonicalScope()
	if scope != "" && (strings.Contains(scope, "?") || !accesscontrol.ValidateScope(scope)) {
		return fmt.Errorf("invalid RBAC scope %q for action %q", scope, permission.Action)
	}
	return nil
}

func nativePermissionTuples(subject string, permission RolePermission) []*openfgav1.TupleKey {
	if isRoleManagementAction(permission.Action) {
		return RoleManagementToTuples(subject, permission)
	}
	if isUserManagementAction(permission.Action) {
		return UserManagementToTuples(subject, permission)
	}
	if isTeamManagementAction(permission.Action) {
		return TeamRoleBindingManagementToTuples(subject, permission)
	}
	if tuple, ok := TranslateToResourceTuple(subject, permission.Action, permission.Kind, permission.Identifier); ok {
		return []*openfgav1.TupleKey{tuple}
	}
	return nil
}

func fallbackEncode(value string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}

func FallbackActionObject(action string) string {
	return NewTupleEntry(TypeRBACAction, fallbackIDVersion+"."+fallbackEncode(action), "")
}

func FallbackPermissionObject(action, scope string) string {
	id := fallbackIDVersion + "." + fallbackEncode(action) + "." + fallbackEncode(scope)
	return NewTupleEntry(TypeRBACPermission, id, "")
}

func DecodeFallbackActionObject(object string) (string, error) {
	id, ok := strings.CutPrefix(object, TypeRBACAction+":"+fallbackIDVersion+".")
	if !ok || id == "" {
		return "", errors.New("invalid fallback action object")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(id)
	if err != nil {
		return "", fmt.Errorf("invalid fallback action ID: %w", err)
	}
	return string(decoded), nil
}

func DecodeFallbackPermissionObject(object string) (string, string, error) {
	id, ok := strings.CutPrefix(object, TypeRBACPermission+":"+fallbackIDVersion+".")
	if !ok {
		return "", "", errors.New("invalid fallback permission object")
	}
	parts := strings.Split(id, ".")
	if len(parts) != 2 || parts[0] == "" {
		return "", "", errors.New("invalid fallback permission ID")
	}
	action, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", "", fmt.Errorf("invalid fallback permission action ID: %w", err)
	}
	scope, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", fmt.Errorf("invalid fallback permission scope ID: %w", err)
	}
	return string(action), string(scope), nil
}

// FallbackScopeCandidates returns the exact requested scopes and every legacy
// wildcard grant that can contain them. Slash-delimited descendants are kept
// delimiter-bounded so a grant for "a/*" cannot match "ab/...".
func FallbackScopeCandidates(scopes ...string) ([]string, error) {
	seen := make(map[string]struct{})
	for _, scope := range scopes {
		if scope == "" {
			continue
		}
		if strings.Contains(scope, "?") || !accesscontrol.ValidateScope(scope) {
			return nil, fmt.Errorf("invalid requested RBAC scope %q", scope)
		}

		seen[scope] = struct{}{}
		prefix := accesscontrol.ScopePrefix(strings.TrimSuffix(scope, "*"))
		for _, wildcard := range accesscontrol.WildcardsFromPrefix(prefix) {
			seen[wildcard] = struct{}{}
		}

		prefixLen := len(prefix)
		for i := prefixLen; i < len(scope); i++ {
			if scope[i] == '/' {
				seen[scope[:i+1]+"*"] = struct{}{}
			}
		}
	}

	candidates := make([]string, 0, len(seen))
	for candidate := range seen {
		candidates = append(candidates, candidate)
	}
	sort.Strings(candidates)
	return candidates, nil
}
