package resources

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestYAMLToJSON(t *testing.T) {
	for _, tt := range []struct {
		name string
		yaml string
		want string
	}{
		{
			name: "YAML 1.1 boolean words stay strings",
			yaml: "y: 4\nyes: 1\non: 2\nn: 3\nno: 5\noff: 6\nrefId: N\ntarget: Y\nenabled: true\ndisabled: false\n",
			want: `{"y":4,"yes":1,"on":2,"n":3,"no":5,"off":6,"refId":"N","target":"Y","enabled":true,"disabled":false}`,
		},
		{
			name: "timestamps keep the text that was written",
			yaml: "date: 2020-01-01\ntimestamp: 2020-01-01T10:00:00Z\nquoted: \"2020-01-01\"\n",
			want: `{"date":"2020-01-01","timestamp":"2020-01-01T10:00:00Z","quoted":"2020-01-01"}`,
		},
		{
			name: "duplicate keys keep the last value",
			yaml: "a: 1\nb: 2\na: 3\n",
			want: `{"a":3,"b":2}`,
		},
		{
			name: "merge keys are expanded and may be overridden",
			yaml: "base: &base\n  x: 1\n  z: 9\nchild:\n  <<: *base\n  z: 2\n",
			want: `{"base":{"x":1,"z":9},"child":{"x":1,"z":2}}`,
		},
		{
			name: "anchors are expanded",
			yaml: "a: &a {x: 1}\nb: *a\n",
			want: `{"a":{"x":1},"b":{"x":1}}`,
		},
		{
			name: "scalars keep their types",
			yaml: "int: 42\nfloat: 3.5\nbig: 123456789012345678\nhex: 0x1f\noctal: 0o17\nnull: null\ntilde: ~\ntext: hello\n",
			want: `{"int":42,"float":3.5,"big":123456789012345678,"hex":31,"octal":15,"null":null,"tilde":null,"text":"hello"}`,
		},
		{
			name: "non-string keys become their text",
			yaml: "1: a\ntrue: b\n",
			want: `{"1":"a","true":"b"}`,
		},
		{
			name: "binary scalars are decoded",
			yaml: "blob: !!binary aGVsbG8=\n",
			want: `{"blob":"hello"}`,
		},
		{
			name: "only the first document is read",
			yaml: "a: 1\n---\nb: 2\n",
			want: `{"a":1}`,
		},
		{
			name: "JSON input is unchanged",
			yaml: `{"y": 4, "refId": "N", "enabled": true}`,
			want: `{"y":4,"refId":"N","enabled":true}`,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := yamlToJSON([]byte(tt.yaml))
			require.NoError(t, err)
			require.JSONEq(t, tt.want, string(got))
		})
	}
}

// A dashboard file is the case that exposed the YAML 1.1 resolution: the panel
// position key `y` and the `refId` values N and Y were turned into booleans.
func TestDecodeYAMLObject_DashboardPositionKeys(t *testing.T) {
	obj, gvk, err := DecodeYAMLObject(bytes.NewReader([]byte(`apiVersion: dashboard.grafana.app/v1
kind: Dashboard
metadata:
  name: example
spec:
  panels:
    - id: 1
      gridPos:
        x: 0
        y: 4
        w: 12
        h: 4
      targets:
        - refId: N
        - refId: Y
        - refId: A
`)))
	require.NoError(t, err)
	require.Equal(t, "Dashboard", gvk.Kind)

	panels, found, err := unstructured.NestedSlice(obj.Object, "spec", "panels")
	require.NoError(t, err)
	require.True(t, found)
	require.Len(t, panels, 1)

	panel, ok := panels[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, map[string]any{"x": int64(0), "y": int64(4), "w": int64(12), "h": int64(4)}, panel["gridPos"])

	targets, ok := panel["targets"].([]any)
	require.True(t, ok)
	require.Len(t, targets, 3)
	for i, want := range []string{"N", "Y", "A"} {
		target, ok := targets[i].(map[string]any)
		require.True(t, ok)
		require.Equal(t, want, target["refId"])
	}
}
