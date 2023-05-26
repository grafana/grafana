package apiserver

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestKeyParsing(t *testing.T) {
	gr := &schema.GroupResource{Group: "G", Resource: "R"}

	out, err := keyToGRN("a", gr)
	require.Error(t, err)
	require.Nil(t, out)

	out, err = keyToGRN("default/c", gr)
	require.NoError(t, err)
	require.Equal(t, "R", out.Kind)
	require.Equal(t, int64(1), out.TenantId)
	require.Equal(t, "c", out.UID)

	out, err = keyToGRN("org-6/caagas", gr)
	require.NoError(t, err)
	require.Equal(t, int64(6), out.TenantId)

	out, err = keyToGRN("tenant-6/caagas", gr)
	require.NoError(t, err)
	require.Equal(t, int64(6), out.TenantId)
}
