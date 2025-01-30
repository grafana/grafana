package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidate(t *testing.T) {
	obj := &Unstructured{
		Object: map[string]interface{}{
			"int":    int(2),
			"int16":  int16(2),
			"int32":  int32(2),
			"uint64": uint64(2),
			"ref": &ObjectReference{
				Resource: "x",
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
