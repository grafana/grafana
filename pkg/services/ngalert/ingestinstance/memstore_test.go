package ingestinstance

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMemStore_CreateAndGetByToken(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	inst := &Instance{
		Token:    "tok-1",
		Name:     "Test Instance",
		PluginID: "grafana-webhook-alerting",
		OrgID:    1,
		Settings: json.RawMessage(`{"static_labels":{"team":"platform"}}`),
	}

	require.NoError(t, store.Create(ctx, inst))

	got, err := store.GetByToken(ctx, "tok-1")
	require.NoError(t, err)
	assert.Equal(t, "tok-1", got.Token)
	assert.Equal(t, "Test Instance", got.Name)
	assert.Equal(t, "grafana-webhook-alerting", got.PluginID)
	assert.Equal(t, int64(1), got.OrgID)
	assert.JSONEq(t, `{"static_labels":{"team":"platform"}}`, string(got.Settings))
	assert.False(t, got.CreatedAt.IsZero(), "CreatedAt should be set")
	assert.False(t, got.UpdatedAt.IsZero(), "UpdatedAt should be set")
}

func TestMemStore_GetByToken_ReturnsCopy(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-1", PluginID: "p", OrgID: 1, Settings: json.RawMessage(`{}`)}))

	got1, err := store.GetByToken(ctx, "tok-1")
	require.NoError(t, err)

	// Mutate the returned instance — should not affect the store.
	got1.Name = "mutated"

	got2, err := store.GetByToken(ctx, "tok-1")
	require.NoError(t, err)
	assert.Empty(t, got2.Name, "store should not be affected by caller mutations")
}

func TestMemStore_GetByToken_NotFound(t *testing.T) {
	store := NewMemStore()

	_, err := store.GetByToken(context.Background(), "nonexistent")
	assert.ErrorIs(t, err, ErrInstanceNotFound)
}

func TestMemStore_Create_DuplicateToken(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	inst := &Instance{Token: "tok-1", PluginID: "p", OrgID: 1}
	require.NoError(t, store.Create(ctx, inst))

	err := store.Create(ctx, &Instance{Token: "tok-1", PluginID: "p", OrgID: 2})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestMemStore_Update(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{
		Token: "tok-1", Name: "Original", PluginID: "p", OrgID: 1,
		Settings: json.RawMessage(`{"old": true}`),
	}))

	before, _ := store.GetByToken(ctx, "tok-1")

	// Small delay so UpdatedAt is different.
	time.Sleep(time.Millisecond)

	updated, err := store.Update(ctx, 1, "tok-1", "Updated Name", json.RawMessage(`{"new": true}`))
	require.NoError(t, err)

	assert.Equal(t, "Updated Name", updated.Name)
	assert.JSONEq(t, `{"new": true}`, string(updated.Settings))
	assert.Equal(t, before.CreatedAt, updated.CreatedAt, "CreatedAt should not change")
	assert.True(t, updated.UpdatedAt.After(before.UpdatedAt), "UpdatedAt should advance")
}

func TestMemStore_Update_WrongOrg(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-1", PluginID: "p", OrgID: 1}))

	_, err := store.Update(ctx, 2, "tok-1", "nope", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInstanceNotFound)
}

func TestMemStore_Update_NotFound(t *testing.T) {
	store := NewMemStore()

	_, err := store.Update(context.Background(), 1, "nonexistent", "name", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInstanceNotFound)
}

func TestMemStore_Delete(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	inst := &Instance{Token: "tok-1", PluginID: "p", OrgID: 1}
	require.NoError(t, store.Create(ctx, inst))

	require.NoError(t, store.Delete(ctx, 1, "tok-1"))

	_, err := store.GetByToken(ctx, "tok-1")
	assert.ErrorIs(t, err, ErrInstanceNotFound)
}

func TestMemStore_Delete_WrongOrg(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-1", PluginID: "p", OrgID: 1}))

	err := store.Delete(ctx, 2, "tok-1")
	assert.ErrorIs(t, err, ErrInstanceNotFound)

	// Instance should still exist.
	got, err := store.GetByToken(ctx, "tok-1")
	require.NoError(t, err)
	assert.Equal(t, "tok-1", got.Token)
}

func TestMemStore_Delete_NotFound(t *testing.T) {
	store := NewMemStore()
	err := store.Delete(context.Background(), 1, "nonexistent")
	assert.ErrorIs(t, err, ErrInstanceNotFound)
}

func TestMemStore_ListByOrg(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-1", PluginID: "p", OrgID: 1}))
	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-2", PluginID: "p", OrgID: 1}))
	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-3", PluginID: "p", OrgID: 2}))

	org1, err := store.ListByOrg(ctx, 1)
	require.NoError(t, err)
	assert.Len(t, org1, 2)

	org2, err := store.ListByOrg(ctx, 2)
	require.NoError(t, err)
	assert.Len(t, org2, 1)
	assert.Equal(t, "tok-3", org2[0].Token)
}

func TestMemStore_ListByOrg_Empty(t *testing.T) {
	store := NewMemStore()

	result, err := store.ListByOrg(context.Background(), 99)
	require.NoError(t, err)
	assert.NotNil(t, result, "should return empty slice, not nil")
	assert.Empty(t, result)
}

func TestMemStore_OrgIsolation(t *testing.T) {
	store := NewMemStore()
	ctx := context.Background()

	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-org1", PluginID: "p", OrgID: 1}))
	require.NoError(t, store.Create(ctx, &Instance{Token: "tok-org2", PluginID: "p", OrgID: 2}))

	got, err := store.GetByToken(ctx, "tok-org1")
	require.NoError(t, err)
	assert.Equal(t, int64(1), got.OrgID)

	// Delete requires the correct org.
	err = store.Delete(ctx, 2, "tok-org1")
	assert.ErrorIs(t, err, ErrInstanceNotFound)

	// Update requires the correct org.
	_, err = store.Update(ctx, 2, "tok-org1", "nope", json.RawMessage(`{}`))
	assert.ErrorIs(t, err, ErrInstanceNotFound)

	// ListByOrg only returns instances for that org.
	org1, err := store.ListByOrg(ctx, 1)
	require.NoError(t, err)
	assert.Len(t, org1, 1)
	assert.Equal(t, "tok-org1", org1[0].Token)
}
