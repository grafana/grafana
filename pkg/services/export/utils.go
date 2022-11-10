package export

import "strings"

func IsTableNotExistsError(err error) bool {
	txt := err.Error()
	return strings.HasPrefix(txt, "no such table") ||
		strings.HasSuffix(txt, "does not exist")
}
