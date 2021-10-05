//go:build !windows
// +build !windows

package process

import (
	"fmt"
	"os"
	"os/user"
)

func elevatedPrivilegesCheck() (bool, error) {
	u, err := user.Current()
	if err != nil {
		return false, fmt.Errorf("could not get current OS user to detect process privileges")
	}

	return (u != nil && u.Username == "root") ||
		os.Geteuid() != os.Getuid() ||
		os.Geteuid() == 0, nil
}
