package builder

import (
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
)

func TestOpenAPI_GetPathOperations(t *testing.T) {
	testCases := []struct {
		name    string
		input   *spec3.Path
		expect  []string // the methods we should see
		exclude []string // the methods we should never see
	}{
		{
			name: "some operations",
			input: &spec3.Path{
				PathProps: spec3.PathProps{
					Get:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "get"}},
					Post:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "post"}},
					Delete: &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "delete"}},
				},
			},
			expect:  []string{"GET", "POST", "DELETE"},
			exclude: []string{"PUT", "PATCH", "OPTIONS", "HEAD", "TRACE"},
		},
		{
			name: "all operations",
			input: &spec3.Path{
				PathProps: spec3.PathProps{
					Get:     &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "get"}},
					Post:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "post"}},
					Delete:  &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "delete"}},
					Put:     &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "put"}},
					Patch:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "patch"}},
					Options: &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "options"}},
					Head:    &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "head"}},
					Trace:   &spec3.Operation{OperationProps: spec3.OperationProps{Summary: "trace"}},
				},
			},
			expect:  []string{"GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS", "HEAD", "TRACE"},
			exclude: []string{},
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			expect := make(map[string]bool)
			for _, k := range tt.expect {
				expect[k] = true
			}

			for k, op := range GetPathOperations(tt.input) {
				require.NotNil(t, op)
				require.Equal(t, strings.ToLower(k), op.Summary)

				if !expect[k] {
					if slices.Contains(tt.expect, k) {
						require.Fail(t, "method returned multiple times", k)
					} else {
						require.Fail(t, "unexpected method", k)
					}
				}
				delete(expect, k)
				require.NotContains(t, tt.exclude, k, "exclude")
			}

			if len(expect) > 0 {
				require.Fail(t, "missing expected method", expect)
			}
		})
	}
}
