package ldap

import (
	"strings"

	LDAP "gopkg.in/ldap.v3"
)

func (ldap *ldapAuther) Close() {
	ldap.conn.Close()
}

func (ldap *ldapAuther) Users() ([]*LdapUserInfo, error) {
	var result *LDAP.SearchResult
	var err error
	server := ldap.config.Servers[0]

	for _, base := range server.SearchBaseDNs {
		attributes := make([]string, 0)
		inputs := server.Attr
		attributes = appendIfNotEmpty(
			attributes,
			inputs.Username,
			inputs.Surname,
			inputs.Email,
			inputs.Name,
			inputs.MemberOf,
		)

		req := LDAP.SearchRequest{
			BaseDN:       base,
			Scope:        LDAP.ScopeWholeSubtree,
			DerefAliases: LDAP.NeverDerefAliases,
			Attributes:   attributes,

			// Doing a star here to get all the users in one go
			Filter: strings.Replace(server.SearchFilter, "%s", "*", -1),
		}

		result, err = ldap.conn.Search(&req)
		if err != nil {
			return nil, err
		}

		if len(result.Entries) > 0 {
			break
		}
	}

	return ldap.serializeUsers(result), nil
}

func (ldap *ldapAuther) serializeUsers(users *LDAP.SearchResult) []*LdapUserInfo {

	var serialized []*LdapUserInfo

	for index := range users.Entries {
		serialize := &LdapUserInfo{
			DN:        getLdapAttrN("dn", users, index),
			LastName:  getLdapAttrN(ldap.server.Attr.Surname, users, index),
			FirstName: getLdapAttrN(ldap.server.Attr.Name, users, index),
			Username:  getLdapAttrN(ldap.server.Attr.Username, users, index),
			Email:     getLdapAttrN(ldap.server.Attr.Email, users, index),
			MemberOf:  getLdapAttrArrayN(ldap.server.Attr.MemberOf, users, index),
		}

		serialized = append(serialized, serialize)
	}

	return serialized
}
