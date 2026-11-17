package smoke

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPreservationError(t *testing.T) {
	for _, tc := range []struct {
		name      string
		want, got string
		ok        bool
	}{
		{"same", `{"a":1,"b":"x"}`, `{"a":1,"b":"x"}`, true},
		{"defaults added", `{"a":1}`, `{"a":1,"refresh":"","intervals":["5s"]}`, true},
		{"empty values dropped", `{"a":1,"b":"","c":false,"d":[],"e":{"list":[]}}`, `{"a":1}`, true},
		{"empty object gets defaults", `{"timepicker":{}}`, `{"timepicker":{"refresh_intervals":["5s"]}}`, true},
		{"value lost", `{"title":"x"}`, `{}`, false},
		{"value changed", `{"title":"x"}`, `{"title":"y"}`, false},
		{"zero kept significant", `{"n":0}`, `{}`, false},
		{"false replaced", `{"hide":false}`, `{"hide":true}`, false},
		{"empty string replaced", `{"timezone":""}`, `{"timezone":"utc"}`, false},
		{"empty list replaced", `{"links":[]}`, `{"links":[{"url":"x"}]}`, false},
		{"null replaced", `{"x":null}`, `{"x":"set"}`, false},
		{"nested empty replaced", `{"templating":{"list":[]}}`, `{"templating":{"list":[{"name":"v"}]}}`, false},
		{"large integer changed", `{"id":9007199254740992}`, `{"id":9007199254740993}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := preservationErrorJSON([]byte(tc.want), []byte(tc.got))
			if tc.ok {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestSameSpecError(t *testing.T) {
	for _, tc := range []struct {
		name      string
		want, got string
		ok        bool
	}{
		{"same", `{"a":1,"b":"x"}`, `{"b":"x","a":1}`, true},
		{"value changed", `{"a":1}`, `{"a":2}`, false},
		{"field added", `{"a":1}`, `{"a":1,"b":2}`, false},
		{"large integer changed", `{"id":9007199254740992}`, `{"id":9007199254740993}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := sameSpecError([]byte(tc.want), []byte(tc.got))
			if tc.ok {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
