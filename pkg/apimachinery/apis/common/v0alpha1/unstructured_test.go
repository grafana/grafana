package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestDeepCopyJSON(t *testing.T) {
	obj := &Unstructured{
		Object: map[string]any{
			"int":    int(2),
			"int16":  int16(2),
			"int32":  int32(2),
			"uint64": uint64(2),
			"ref": &ObjectReference{
				Kind: "x",
			},
			"array": []any{
				int(1), int64(2), "hello",
			},
			"string": "hello",
			"bool":   true,
			"map": map[string]any{
				"x": &ObjectReference{
					Kind: "x",
				},
			},
			"object": &v1.APIGroup{
				Name: "HELLO",
			},
		},
	}
	before, err := json.Marshal(obj)
	require.NoError(t, err)

	clone := obj.DeepCopy()
	after, err := json.Marshal(clone)
	require.NoError(t, err)

	require.JSONEq(t, string(before), string(after))
}
