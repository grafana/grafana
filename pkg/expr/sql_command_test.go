package expr

import (
	"strings"
	"testing"
)

func TestNewCommand(t *testing.T) {
	sql := "select a,b,c from foo"
	cmd, err := NewSQLCommand("a", "select a,b,c from foo", nil)
	if err != nil {
		t.Fail()
		return
	}

	for _, v := range cmd.varsToQuery {
		if strings.Contains(sql, v) {
			continue
		}
		t.Fail()
		return
	}
}
