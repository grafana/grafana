package process

func IsRunningWithElevatedPrivileges() (bool, error) {
	return elevatedPrivilegesCheck()
}
