package auth

type ldapUserInfo struct {
	FirstName string
	LastName  string
	Username  string
	Email     string
	MemberOf  []string
}

func (u *ldapUserInfo) isMemberOf(group string) bool {
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
