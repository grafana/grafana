// +build windows

package process

import (
	"fmt"

	"golang.org/x/sys/windows"
)

func isServerRunningAsRoot() (bool, error) {
	var sid *windows.SID
	defer windows.FreeSid(sid)

	//  The Go API for this is a direct wrap of the official C++ API.
	// See https://docs.microsoft.com/en-us/windows/desktop/api/securitybaseapi/nf-securitybaseapi-checktokenmembership
	err := windows.AllocateAndInitializeSid(
		&windows.SECURITY_NT_AUTHORITY,
		2,
		windows.SECURITY_BUILTIN_DOMAIN_RID,
		windows.DOMAIN_ALIAS_RID_ADMINS,
		0, 0, 0, 0, 0, 0,
		&sid)
	if err != nil {
		return false, fmt.Errorf("error during windows SID initialization: %w", err)
	}

	token := windows.Token(0)
	isRoot, err := token.IsMember(sid)
	if err != nil {
		return false, fmt.Errorf("error checking if token is member of SID: %w", err)
	}

	return isRoot, nil
}
