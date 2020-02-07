package backendplugin

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestLogWrapper(t *testing.T) {
	tcs := []struct {
		args           []interface{}
		expectedResult []interface{}
	}{
		{args: []interface{}{}, expectedResult: []interface{}{}},
		{args: []interface{}{"1", "2", "3"}, expectedResult: []interface{}{"1", "2", "3"}},
		{args: []interface{}{"1", "2"}, expectedResult: []interface{}{"1", "2"}},
		{args: []interface{}{"1", "2", "timestamp", time.Now()}, expectedResult: []interface{}{"1", "2"}},
		{args: []interface{}{"1", "2", "timestamp", time.Now(), "3", "4"}, expectedResult: []interface{}{"1", "2", "3", "4"}},
	}

	for i, tc := range tcs {
		t.Run(fmt.Sprintf("formatArgs testcase %d", i), func(t *testing.T) {
			res := formatArgs(tc.args...)
			assert.Exactly(t, tc.expectedResult, res)
		})
	}
}
