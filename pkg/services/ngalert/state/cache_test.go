package state

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestBuildTemplateData(t *testing.T) {
	cases := []struct {
		name   string
		result eval.Result
		labels map[string]string
		values map[string]string
	}{{
		name: "assert nil value is returned as null",
		result: eval.Result{
			Values: map[string]*float64{"A": nil},
		},
		labels: make(map[string]string),
		values: map[string]string{
			"A": "null",
		},
	}, {
		name: "assert non-nil values are returned as string without exponent",
		result: eval.Result{
			Values: map[string]*float64{
				"A": ptr.Float64(1),
				"B": ptr.Float64(1.5)},
		},
		labels: make(map[string]string),
		values: map[string]string{
			"A": "1",
			"B": "1.5",
		},
	}}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			l, v := buildTemplateData(tc.result)
			require.Equal(t, tc.labels, l)
			require.Equal(t, tc.values, v)
		})
	}
}
