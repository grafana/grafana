package tokenexchange

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

// configureUnattendedDelegation authorizes asserted-subject requests within the
// manifest's delegated grant. Only server configuration can enable it.
func configureUnattendedDelegation(policy *v3.LocalAccessPolicy, settings map[string]string) error {
	value := settings["allow_unattended_delegation"]
	if value == "" {
		return nil
	}
	enabled, err := strconv.ParseBool(value)
	if err != nil {
		return fmt.Errorf("invalid allow_unattended_delegation: %w", err)
	}
	if !enabled {
		return nil
	}
	restrictions := strings.Fields(settings["unattended_delegation_permissions"])
	for _, permission := range restrictions {
		action, verb, ok := strings.Cut(permission, ":")
		if !ok || action == "" || verb == "" || strings.Contains(permission, ",") {
			return errors.New("unattended_delegation_permissions requires space-separated actions")
		}
	}
	var maximum time.Duration
	if value := settings["unattended_delegation_max_token_lifetime"]; value != "" {
		maximum, err = time.ParseDuration(value)
		if err != nil || maximum < v3.DefaultLocalUnattendedDelegationTokenLifetime || maximum%time.Second != 0 {
			return fmt.Errorf("unattended_delegation_max_token_lifetime must be a duration of at least %s in whole seconds", v3.DefaultLocalUnattendedDelegationTokenLifetime)
		}
	}
	policy.AllowUnattendedDelegation = true
	if len(restrictions) > 0 {
		// Match the local exchange's RestrictedDelegatedPermissions semantics:
		// select existing grant entries without expanding or adding permissions.
		policy.DelegatedPermissions = slices.DeleteFunc(slices.Clone(policy.DelegatedPermissions), func(permission string) bool {
			return !slices.Contains(restrictions, permission)
		})
	}
	policy.MaxUnattendedDelegationTokenLifetime = maximum
	return nil
}
