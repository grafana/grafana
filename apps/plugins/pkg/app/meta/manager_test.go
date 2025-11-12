package meta

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

func TestNewProviderManager(t *testing.T) {
	t.Run("panics with no providers", func(t *testing.T) {
		assert.Panics(t, func() {
			NewProviderManager()
		})
	})

	t.Run("creates manager with providers", func(t *testing.T) {
		provider1 := &mockProvider{}
		provider2 := &mockProvider{}

		pm := NewProviderManager(provider1, provider2)

		require.NotNil(t, pm)
		assert.Len(t, pm.providers, 2)
		assert.NotNil(t, pm.cache)
	})
}

func TestProviderManager_GetMeta(t *testing.T) {
	ctx := context.Background()

	t.Run("returns cached result when available and not expired", func(t *testing.T) {
		cachedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: cachedMeta,
					TTL:  time.Hour,
				}, nil
			},
		}

		pm := NewProviderManager(provider)

		result1, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")
		require.NoError(t, err)
		require.NotNil(t, result1)
		assert.Equal(t, cachedMeta, result1.Meta)
		assert.Equal(t, time.Hour, result1.TTL)

		provider.getMetaFunc = func(ctx context.Context, pluginID, version string) (*Result, error) {
			return &Result{
				Meta: &pluginsv0alpha1.GetMeta{Id: "different"},
				TTL:  time.Hour,
			}, nil
		}

		result2, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")
		require.NoError(t, err)
		require.NotNil(t, result2)
		assert.Equal(t, cachedMeta, result2.Meta)
		assert.Equal(t, time.Hour, result2.TTL)
	})

	t.Run("fetches from provider when not cached", func(t *testing.T) {
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}
		expectedTTL := 2 * time.Hour

		provider := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: expectedMeta,
					TTL:  expectedTTL,
				}, nil
			},
		}

		pm := NewProviderManager(provider)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)
		assert.Equal(t, expectedTTL, result.TTL)

		pm.cacheMu.RLock()
		cached, exists := pm.cache["test-plugin:1.0.0"]
		pm.cacheMu.RUnlock()

		assert.True(t, exists)
		assert.Equal(t, expectedMeta, cached.meta)
		assert.Equal(t, expectedTTL, cached.ttl)
	})

	t.Run("does not cache result with zero TTL and tries next provider", func(t *testing.T) {
		zeroTTLMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Zero TTL Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider1 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: zeroTTLMeta,
					TTL:  0,
				}, nil
			},
		}
		provider2 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: expectedMeta,
					TTL:  time.Hour,
				}, nil
			},
		}

		pm := NewProviderManager(provider1, provider2)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)

		pm.cacheMu.RLock()
		cached, exists := pm.cache["test-plugin:1.0.0"]
		pm.cacheMu.RUnlock()

		assert.True(t, exists)
		assert.Equal(t, expectedMeta, cached.meta)
		assert.Equal(t, time.Hour, cached.ttl)
	})

	t.Run("tries next provider when first returns ErrMetaNotFound", func(t *testing.T) {
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider1 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return nil, ErrMetaNotFound
			},
		}
		provider2 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: expectedMeta,
					TTL:  time.Hour,
				}, nil
			},
		}

		pm := NewProviderManager(provider1, provider2)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta, result.Meta)
	})

	t.Run("returns ErrMetaNotFound when all providers return ErrMetaNotFound", func(t *testing.T) {
		provider1 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return nil, ErrMetaNotFound
			},
		}
		provider2 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return nil, ErrMetaNotFound
			},
		}

		pm := NewProviderManager(provider1, provider2)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.True(t, errors.Is(err, ErrMetaNotFound))
		assert.Nil(t, result)
	})

	t.Run("returns error when provider returns non-ErrMetaNotFound error", func(t *testing.T) {
		expectedErr := errors.New("network error")

		provider1 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return nil, expectedErr
			},
		}
		provider2 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return nil, ErrMetaNotFound
			},
		}

		pm := NewProviderManager(provider1, provider2)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "failed to fetch plugin metadata from any provider")
		assert.ErrorIs(t, err, expectedErr)
		assert.Nil(t, result)
	})

	t.Run("skips expired cache entries", func(t *testing.T) {
		expiredMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Expired Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}
		expectedMeta := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		callCount := 0
		provider := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				callCount++
				if callCount == 1 {
					return &Result{
						Meta: expiredMeta,
						TTL:  time.Nanosecond,
					}, nil
				}
				return &Result{
					Meta: expectedMeta,
					TTL:  time.Hour,
				}, nil
			},
		}

		pm := NewProviderManager(provider)

		result1, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")
		require.NoError(t, err)
		assert.Equal(t, expiredMeta, result1.Meta)

		time.Sleep(2 * time.Nanosecond)

		result2, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")
		require.NoError(t, err)
		assert.Equal(t, expectedMeta, result2.Meta)
		assert.Equal(t, 2, callCount)
	})

	t.Run("uses first successful provider", func(t *testing.T) {
		expectedMeta1 := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Provider 1 Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}
		expectedMeta2 := &pluginsv0alpha1.GetMeta{
			Id:   "test-plugin",
			Name: "Provider 2 Plugin",
			Type: pluginsv0alpha1.GetMetaTypeDatasource,
		}

		provider1 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: expectedMeta1,
					TTL:  time.Hour,
				}, nil
			},
		}
		provider2 := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				return &Result{
					Meta: expectedMeta2,
					TTL:  time.Hour,
				}, nil
			},
		}

		pm := NewProviderManager(provider1, provider2)

		result, err := pm.GetMeta(ctx, "test-plugin", "1.0.0")

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, expectedMeta1, result.Meta)
	})
}

func TestProviderManager_Run(t *testing.T) {
	t.Run("runs cleanup loop until context cancelled", func(t *testing.T) {
		pm := NewProviderManager(&mockProvider{})

		ctx, cancel := context.WithCancel(context.Background())

		done := make(chan error, 1)
		go func() {
			done <- pm.Run(ctx)
		}()

		time.Sleep(10 * time.Millisecond)
		cancel()

		err := <-done
		require.NoError(t, err)
	})
}

func TestProviderManager_cleanupExpired(t *testing.T) {
	t.Run("removes expired entries", func(t *testing.T) {
		validMeta := &pluginsv0alpha1.GetMeta{Id: "valid"}
		expiredMeta1 := &pluginsv0alpha1.GetMeta{Id: "expired1"}
		expiredMeta2 := &pluginsv0alpha1.GetMeta{Id: "expired2"}

		provider := &mockProvider{
			getMetaFunc: func(ctx context.Context, pluginID, version string) (*Result, error) {
				switch pluginID {
				case "valid":
					return &Result{Meta: validMeta, TTL: time.Hour}, nil
				case "expired1":
					return &Result{Meta: expiredMeta1, TTL: time.Nanosecond}, nil
				case "expired2":
					return &Result{Meta: expiredMeta2, TTL: time.Nanosecond}, nil
				}
				return nil, ErrMetaNotFound
			},
		}

		pm := NewProviderManager(provider)
		ctx := context.Background()

		_, err := pm.GetMeta(ctx, "expired1", "1.0.0")
		require.NoError(t, err)
		_, err = pm.GetMeta(ctx, "expired2", "1.0.0")
		require.NoError(t, err)
		_, err = pm.GetMeta(ctx, "valid", "1.0.0")
		require.NoError(t, err)

		time.Sleep(2 * time.Nanosecond)

		pm.cleanupExpired()

		provider.getMetaFunc = func(ctx context.Context, pluginID, version string) (*Result, error) {
			if pluginID == "valid" {
				return &Result{Meta: validMeta, TTL: time.Hour}, nil
			}
			return nil, ErrMetaNotFound
		}

		result, err := pm.GetMeta(ctx, "expired1", "1.0.0")
		assert.Error(t, err)

		result, err = pm.GetMeta(ctx, "valid", "1.0.0")
		require.NoError(t, err)
		assert.Equal(t, validMeta, result.Meta)
	})

	t.Run("handles empty cache", func(t *testing.T) {
		pm := NewProviderManager(&mockProvider{})
		pm.cleanupExpired()
	})
}

func TestProviderManager_cacheKey(t *testing.T) {
	pm := NewProviderManager(&mockProvider{})

	tests := []struct {
		name     string
		pluginID string
		version  string
		expected string
	}{
		{
			name:     "basic key",
			pluginID: "test-plugin",
			version:  "1.0.0",
			expected: "test-plugin:1.0.0",
		},
		{
			name:     "empty version",
			pluginID: "test-plugin",
			version:  "",
			expected: "test-plugin:",
		},
		{
			name:     "empty plugin ID",
			pluginID: "",
			version:  "1.0.0",
			expected: ":1.0.0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := pm.cacheKey(tt.pluginID, tt.version)
			assert.Equal(t, tt.expected, key)
		})
	}
}

type mockProvider struct {
	getMetaFunc func(ctx context.Context, pluginID, version string) (*Result, error)
}

func (m *mockProvider) GetMeta(ctx context.Context, pluginID, version string) (*Result, error) {
	if m.getMetaFunc != nil {
		return m.getMetaFunc(ctx, pluginID, version)
	}
	return nil, ErrMetaNotFound
}
