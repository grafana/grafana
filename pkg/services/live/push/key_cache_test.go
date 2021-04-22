package push

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

func Test_apiKeyCache_Run(t *testing.T) {
	keyCache := newAPIKeyCache(nil, time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	errCh := make(chan error, 1)
	go func() {
		errCh <- keyCache.Run(ctx)
	}()
	cancel()
	select {
	case <-time.After(5 * time.Second):
		t.Fatal("timeout")
	case err := <-errCh:
		require.ErrorIs(t, err, context.Canceled)
	}
}

func Test_apiKeyCache_Get_Set(t *testing.T) {
	keyCache := newAPIKeyCache(func(key string) (*models.ApiKey, bool, error) {
		return &models.ApiKey{}, true, nil
	}, time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = keyCache.Run(ctx)
	}()

	_, ok := keyCache.Get("test")
	require.False(t, ok)

	keyCache.Set("test", nil)
	keyInfo, ok := keyCache.Get("test")
	require.True(t, ok)
	require.Zero(t, keyInfo.ExpiresAt)

	now := time.Now().Unix() + 100
	keyCache.Set("test", &now)
	keyInfo, ok = keyCache.Get("test")
	require.True(t, ok)
	require.True(t, keyInfo.ExpiresAt > time.Now().Unix())
}

func Test_apiKeyCache_invalidateKeys(t *testing.T) {
	tests := []struct {
		name                       string
		keyCheckFunc               keyCheckFunc
		expireAt                   int64
		mustExistAfterInvalidation bool
	}{
		{
			name: "valid",
			keyCheckFunc: func(key string) (*models.ApiKey, bool, error) {
				require.Equal(t, "test", key)
				return &models.ApiKey{}, true, nil
			},
			expireAt:                   0,
			mustExistAfterInvalidation: true,
		},
		{
			name: "revoked",
			keyCheckFunc: func(key string) (*models.ApiKey, bool, error) {
				require.Equal(t, "test", key)
				return &models.ApiKey{}, false, nil
			},
			expireAt:                   0,
			mustExistAfterInvalidation: false,
		},
		{
			name: "expired",
			keyCheckFunc: func(key string) (*models.ApiKey, bool, error) {
				panic("should not be called since key must be deleted due to expiration")
				return &models.ApiKey{}, true, nil
			},
			expireAt:                   time.Now().Unix() - 10, // In the past.
			mustExistAfterInvalidation: false,
		},
		{
			name: "error",
			keyCheckFunc: func(key string) (*models.ApiKey, bool, error) {
				return nil, false, errors.New("boom")
			},
			expireAt:                   0,
			mustExistAfterInvalidation: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			keyCache := newAPIKeyCache(tt.keyCheckFunc, time.Hour)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			go func() {
				_ = keyCache.Run(ctx)
			}()

			keyCache.Set("test", &tt.expireAt)
			keyCache.invalidateKeys()
			_, ok := keyCache.Get("test")
			require.Equal(t, tt.mustExistAfterInvalidation, ok)
			if !tt.mustExistAfterInvalidation {
				require.Len(t, keyCache.cache, 0)
			} else {
				require.Len(t, keyCache.cache, 1)
			}
		})
	}
}

func Test_apiKeyCache_ExpiredOnGet(t *testing.T) {
	keyCache := newAPIKeyCache(func(key string) (*models.ApiKey, bool, error) {
		return &models.ApiKey{}, true, nil
	}, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		_ = keyCache.Run(ctx)
	}()

	expiresAt := time.Now().Unix() - 1 // In the past.

	keyCache.Set("test", &expiresAt)
	_, ok := keyCache.Get("test")
	require.False(t, ok)
}
