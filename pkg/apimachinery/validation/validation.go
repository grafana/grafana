package validation

import (
	"regexp"

	"k8s.io/apimachinery/pkg/util/validation"
)

const maxNameLength = 253
const maxNamespaceLength = 40
const minNamespaceLength = 3
const maxGroupLength = 60
const minGroupLength = 3
const maxResourceLength = 40
const minResourceLength = 3

const grafanaNameFmt = `^[a-zA-Z0-9:\-\_\.]*$`
const grafanaNameErrMsg string = "must consist of alphanumeric characters, '-', '_', ':' or '.'"

const qnameCharFmt string = "[A-Za-z0-9]"
const qnameExtCharFmt string = "[-A-Za-z0-9_.]"
const qualifiedNameFmt string = "^(" + qnameCharFmt + qnameExtCharFmt + "*)?" + qnameCharFmt + "$"
const qualifiedNameErrMsg string = "must consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character"

const alphaCharFmt string = "[A-Za-z]"
const resourceCharFmt string = "[A-Za-z0-9-]" // alpha numeric plus dashes
const resourceFmt string = "^" + alphaCharFmt + resourceCharFmt + "*$"
const resourceErrMsg string = "must consist of alphanumeric characters and dashes, and must start with an alphabetic character"

var (
	grafanaNameRegexp   = regexp.MustCompile(grafanaNameFmt).MatchString
	qualifiedNameRegexp = regexp.MustCompile(qualifiedNameFmt).MatchString
	resourceRegexp      = regexp.MustCompile(resourceFmt).MatchString
)

// IsValidGrafanaName checks if the name is a valid to use for a k8s name
// Unlike normal k8s name rules, this allows the name to start with a digit
// This compromise means existing grafana UIDs are valid k8s names without migration
func IsValidGrafanaName(name string) []string {
	s := len(name)
	switch {
	case s == 0:
		return []string{"name may not be empty"}
	case s > maxNameLength:
		return []string{"name is too long"}
	}

	if !grafanaNameRegexp(name) {
		return []string{"name " + validation.RegexError(grafanaNameErrMsg, grafanaNameFmt, "MyName", "my.name", "abc-123")}
	}
	// In standard k8s, it must not start with a number
	// however that would force us to update many many many existing resources
	// so we will be slightly more lenient than standard k8s
	return nil
}

// If the value is not valid, a list of error strings is returned.
// Otherwise an empty list (or nil) is returned.
func IsValidNamespace(namespace string) []string {
	s := len(namespace)
	switch {
	case s == 0:
		return nil // empty is OK
	case s > maxNamespaceLength:
		return []string{"namespace is too long"}
	case s < minNamespaceLength:
		return []string{"namespace is too short"}
	}
	if !qualifiedNameRegexp(namespace) {
		return []string{"namespace " + validation.RegexError(qualifiedNameErrMsg, qualifiedNameFmt, "MyName", "my.name", "abc-123")}
	}
	return nil
}

// If the value is not valid, a list of error strings is returned.
// Otherwise an empty list (or nil) is returned.
func IsValidGroup(group string) []string {
	s := len(group)
	switch {
	case s > maxGroupLength:
		return []string{"group is too long"}
	case s < minGroupLength:
		return []string{"group is too short"}
	}
	if !qualifiedNameRegexp(group) {
		return []string{"group " + validation.RegexError(qualifiedNameErrMsg, qualifiedNameFmt, "dashboards.grafana.app", "grafana-loki-datasource")}
	}
	return nil
}

// If the value is not valid, a list of error strings is returned.
// Otherwise an empty list (or nil) is returned.
func IsValidResource(resource string) []string {
	s := len(resource)
	switch {
	case s > maxResourceLength:
		return []string{"resource is too long"}
	case s < minResourceLength:
		return []string{"resource is too short"}
	}
	if !resourceRegexp(resource) {
		return []string{"resource " + validation.RegexError(resourceErrMsg, resourceFmt, "dashboards", "folders")}
	}
	return nil
}
