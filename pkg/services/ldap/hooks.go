package ldap

var (
	// if non-nil, overrides ldap Dial.
	testHookDial func() error
)
