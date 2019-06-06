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

func getLDAPAttr(name string, result *ldap.SearchResult) string {
	return getLDAPAttrN(name, result, 0)
}

func getLDAPAttrN(name string, result *ldap.SearchResult, n int) string {
	if strings.ToLower(name) == "dn" {
		return result.Entries[n].DN
	}
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			if len(attr.Values) > 0 {
				return attr.Values[0]
			}
		}
	}
	return ""
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

func getLDAPAttrArray(name string, result *ldap.SearchResult) []string {
	return getLDAPAttrArrayN(name, result, 0)
}

func getLDAPAttrArrayN(name string, result *ldap.SearchResult, n int) []string {
	for _, attr := range result.Entries[n].Attributes {
		if attr.Name == name {
			return attr.Values
		}
	}
	return []string{}
}
