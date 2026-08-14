package grpcplugin

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLogWrapper(t *testing.T) {
	tcs := []struct {
		args           []any
		expectedResult []any
	}{
		{args: []any{}, expectedResult: []any{}},
		{args: []any{"1", "2", "3"}, expectedResult: []any{"1", "2", "3"}},
		{args: []any{"1", "2"}, expectedResult: []any{"1", "2"}},
		{args: []any{"1", "2", "timestamp", time.Now()}, expectedResult: []any{"1", "2"}},
		{args: []any{"1", "2", "timestamp", time.Now(), "3", "4"}, expectedResult: []any{"1", "2", "3", "4"}},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("formatArgs testcase %d", i), func(t *testing.T) {
			res := formatArgs(tc.args...)
			assert.Exactly(t, tc.expectedResult, res)
		})
	}
}
