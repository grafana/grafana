package fsutil

import (
	"fmt"
	"os"
)

// CreateTempFile generates a temp filepath, based on the provided suffix.
// A typical generated path looks like /var/folders/abcd/abcdefg/A/1137975807.
func CreateTempFile(sfx string) (string, error) {
	var suffix string
	if sfx != "" {
		suffix = fmt.Sprintf("*-%s", sfx)
	} else {
		suffix = sfx
	}
	f, err := os.CreateTemp("", suffix)
	if err != nil {
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}

	return f.Name(), nil
}
