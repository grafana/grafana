package manager

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDataKeyCacheIsScopedByNamespace(t *testing.T) {
	c := newDataKeyCache(time.Minute)

	entry := &dataKeyCacheEntry{namespace: "stacks-1", id: "id", label: "label", dataKey: []byte("key"), active: true}
	c.addById(entry)
	c.addByLabel(entry)

	got, ok := c.getById("stacks-1", "id")
	require.True(t, ok)
	require.Equal(t, []byte("key"), got.dataKey)
	got, ok = c.getByLabel("stacks-1", "label")
	require.True(t, ok)
	require.Equal(t, []byte("key"), got.dataKey)

	_, ok = c.getById("stacks-2", "id")
	require.False(t, ok)
	_, ok = c.getByLabel("stacks-2", "label")
	require.False(t, ok)
	_, ok = c.getByLabel("", "label")
	require.False(t, ok)
}
