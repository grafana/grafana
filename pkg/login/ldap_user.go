package login

import (
	"strings"
)

type LdapUserInfo struct {
	DN        string
	FirstName string
	LastName  string
	Username  string
	Email     string
	MemberOf  []string
}

func (u *LdapUserInfo) isMemberOf(group string) bool {
	if group == "*" {
		return true
	}

	for _, member := range u.MemberOf {
		if strings.EqualFold(member, group) {
			return true
		}
	}
	return false
}
