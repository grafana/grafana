package dashboardviews

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeBuilder is the minimum needed to satisfy the local Builder
// interface. The Group/Resource fields drive the filter gate.
type fakeBuilder struct{ group, resource string }

func (b fakeBuilder) Group() string    { return b.group }
func (b fakeBuilder) Resource() string { return b.resource }

func dashBuilder() fakeBuilder {
	return fakeBuilder{group: Group, resource: Resource}
}

// fakeProvider returns the configured stats and error.
type fakeProvider struct {
	stats map[string]int64
	err   error
}

func (f fakeProvider) GetDashboardStats(_ context.Context, _, _ string) (map[string]int64, error) {
	return f.stats, f.err
}

func TestShouldSkip_ZeroViews_Skips(t *testing.T) {
	skip, err := ShouldSkip(context.Background(),
		fakeProvider{stats: map[string]int64{"views_last_30_days": 0}},
		dashBuilder(), "ns", "uid")
	require.NoError(t, err)
	assert.True(t, skip)
}

func TestShouldSkip_HasViews_DoesNotSkip(t *testing.T) {
	skip, err := ShouldSkip(context.Background(),
		fakeProvider{stats: map[string]int64{"views_last_30_days": 1}},
		dashBuilder(), "ns", "uid")
	require.NoError(t, err)
	assert.False(t, skip)
}

func TestShouldSkip_MissingKey_DoesNotSkip(t *testing.T) {
	// Empty map: caller falls back to embedding (best-effort).
	skip, err := ShouldSkip(context.Background(),
		fakeProvider{stats: map[string]int64{}},
		dashBuilder(), "ns", "uid")
	require.NoError(t, err)
	assert.False(t, skip)

	// Map present but key missing: also no-skip.
	skip, err = ShouldSkip(context.Background(),
		fakeProvider{stats: map[string]int64{"views_total": 9}},
		dashBuilder(), "ns", "uid")
	require.NoError(t, err)
	assert.False(t, skip)
}

func TestShouldSkip_ProviderError_PropagatesAndDoesNotSkip(t *testing.T) {
	boom := errors.New("boom")
	skip, err := ShouldSkip(context.Background(),
		fakeProvider{err: boom},
		dashBuilder(), "ns", "uid")
	assert.ErrorIs(t, err, boom, "caller should see the error so it can log")
	assert.False(t, skip, "errors are best-effort: embed anyway")
}

func TestShouldSkip_NilProvider_NoOp(t *testing.T) {
	skip, err := ShouldSkip(context.Background(), nil, dashBuilder(), "ns", "uid")
	require.NoError(t, err)
	assert.False(t, skip)
}

func TestShouldSkip_NonDashboardBuilder_NoOp(t *testing.T) {
	// Filter is dashboard-only; any other group/resource short-circuits
	// before the provider is even consulted.
	called := false
	p := fakeProviderFunc(func(_ context.Context, _, _ string) (map[string]int64, error) {
		called = true
		return map[string]int64{"views_last_30_days": 0}, nil
	})
	skip, err := ShouldSkip(context.Background(), p, fakeBuilder{group: "folder.grafana.app", resource: "folders"}, "ns", "uid")
	require.NoError(t, err)
	assert.False(t, skip)
	assert.False(t, called, "non-dashboard builder must not consult the provider")
}

func TestShouldSkip_EmptyName_NoOp(t *testing.T) {
	called := false
	p := fakeProviderFunc(func(_ context.Context, _, _ string) (map[string]int64, error) {
		called = true
		return nil, nil
	})
	skip, err := ShouldSkip(context.Background(), p, dashBuilder(), "ns", "")
	require.NoError(t, err)
	assert.False(t, skip)
	assert.False(t, called, "empty name must not consult the provider")
}

// fakeProviderFunc adapts a function value to the Provider interface.
type fakeProviderFunc func(ctx context.Context, namespace, uid string) (map[string]int64, error)

func (f fakeProviderFunc) GetDashboardStats(ctx context.Context, namespace, uid string) (map[string]int64, error) {
	return f(ctx, namespace, uid)
}
