package starlarkutil

import (
	"bufio"
	"errors"
	"io"
	"strings"
)

// Variable reads a starlark file for a variable assignment.
// It can't really be perfect without some kind of AST.
// Variable only looks for top-level variables.
// Variable only looks for single-line variables. It may find a multi-line one (like JSON) but it will be incomplete
func Variable(r io.Reader, name string) (string, error) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		v := scanner.Text()
		if strings.HasPrefix(v, "\t") {
			continue
		}
		if strings.HasPrefix(v, " ") {
			continue
		}
		if !strings.HasPrefix(v, name) {
			continue
		}
		p := strings.Split(v, "=")
		if len(p) == 1 {
			continue
		}

		if strings.TrimSpace(p[0]) != name {
			continue
		}

		replacer := strings.NewReplacer("\"", "", "'", "")
		return replacer.Replace(strings.TrimSpace(strings.Join(p[1:], "="))), nil
	}

	return "", errors.New("not found")
}
