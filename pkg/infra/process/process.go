package process

func IsServerProcessRunningWithElevatedPrivileges() (bool, error) {
	return isRunningWithElevatedPrivileges()
}
