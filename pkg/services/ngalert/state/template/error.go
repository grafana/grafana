package template

import (
	"fmt"
)

// ExpandError is an error containing the template and the error that occurred
// while expanding it.
type ExpandError struct {
	Tmpl string
	Err  error
}

func (e ExpandError) Error() string {
	return fmt.Sprintf("failed to expand template '%s': %s", e.Tmpl, e.Err)
}
