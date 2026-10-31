package tokenexchange

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
)

// configureSubjectSigning replaces the manifest's delegated grant only for
// asserted-subject requests. The manifest cannot authorize subject signing.
func configureSubjectSigning(policy *v3.LocalAccessPolicy, settings map[string]string) error {
	value := settings["allow_subject_signing"]
	if value == "" {
		return nil
	}
	enabled, err := strconv.ParseBool(value)
	if err != nil {
		return fmt.Errorf("invalid allow_subject_signing: %w", err)
	}
	if !enabled {
		return nil
	}
	permissions := strings.Fields(settings["subject_signing_permissions"])
	if len(permissions) == 0 {
		return errors.New("subject signing requires delegated permissions")
	}
	for _, permission := range permissions {
		action, verb, ok := strings.Cut(permission, ":")
		if !ok || action == "" || verb == "" || strings.ContainsAny(permission, "*,") {
			return errors.New("subject_signing_permissions requires space-separated concrete actions")
		}
	}
	var maximum time.Duration
	if value := settings["subject_signing_max_token_lifetime"]; value != "" {
		maximum, err = time.ParseDuration(value)
		if err != nil || maximum < v3.DefaultLocalSubjectTokenLifetime || maximum%time.Second != 0 {
			return fmt.Errorf("subject_signing_max_token_lifetime must be a duration of at least %s in whole seconds", v3.DefaultLocalSubjectTokenLifetime)
		}
	}
	policy.AllowSubjectSigning = true
	policy.DelegatedPermissions = permissions
	policy.MaxSubjectTokenLifetime = maximum
	return nil
}
