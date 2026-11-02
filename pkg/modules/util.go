package modules

import "slices"

func stringsContain(values []string, search string) bool {
	return slices.Contains(values, search)
}
