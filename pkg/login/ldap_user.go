package login

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
		if member == group {
			return true
		}
	}
	return false
}
