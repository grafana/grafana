package process

func IsServerProcessRunningAsRoot() (bool, error) {
	return isServerRunningAsRoot()
}
