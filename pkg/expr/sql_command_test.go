package expr

import (
	"strings"
	"testing"
)

func TestNewCommand(t *testing.T) {
	cmd, err := NewSQLCommand("a", "select a from foo, bar", nil)
	if err != nil {
		t.Fail()
		return
	}

	for _, v := range cmd.varsToQuery {
		if strings.Contains("foo bar", v) {
			continue
		}
		t.Fail()
		return
	}
}
