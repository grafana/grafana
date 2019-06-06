package ldap

import (
	"strings"
)

type UserInfo struct {
	DN        string
	FirstName string
	LastName  string
	Username  string
	Email     string
	MemberOf  []string
 Orgid     int64
}

func (u *UserInfo) isMemberOf(group string) bool {
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
