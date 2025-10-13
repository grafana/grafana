package expr

import (
	"strings"
	"testing"
)

func TestNewCommand(t *testing.T) {
	t.Skip()
	cmd, err := NewSQLCommand("a", "select a from foo, bar")
	if err != nil && strings.Contains(err.Error(), "feature is not enabled") {
		return
	}

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
