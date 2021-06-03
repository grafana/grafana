// +build !windows

package process

import (
	"fmt"
	"os"
	"os/user"
)

func isRunningWithElevatedPrivileges() (bool, error) {
	serverProcessUser, err := user.Current()
	if err != nil {
		return false, fmt.Errorf("could not get current OS user to detect process privileges")
	}
	return (serverProcessUser != nil && serverProcessUser.Username == "root") || os.Geteuid() == 0, nil
}
