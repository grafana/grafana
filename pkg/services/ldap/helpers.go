package ldap

import (
	"strings"

	"gopkg.in/ldap.v3"
)

func isMemberOf(memberOf []string, group string) bool {
	if group == "*" {
		return true
	}

	for _, member := range memberOf {
		if strings.EqualFold(member, group) {
			return true
		}
	}
	return false
}

func appendIfNotEmpty(slice []string, values ...string) []string {
	for _, v := range values {
		if v != "" {
			slice = append(slice, v)
		}
	}
	return slice
}

func getAttribute(name string, entry *ldap.Entry) string {
	for _, attr := range entry.Attributes {
		if attr.Name == name {
			if len(attr.Values) > 0 {
				return attr.Values[0]
			}
		}
	}
	return ""
}

func getArrayAttribute(name string, entry *ldap.Entry) []string {
	for _, attr := range entry.Attributes {
		if attr.Name == name && len(attr.Values) > 0 {
			return attr.Values
		}
	}
	return []string{}
}
