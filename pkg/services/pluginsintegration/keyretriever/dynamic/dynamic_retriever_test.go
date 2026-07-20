package dynamic

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keystore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func setFakeAPIServer(t *testing.T, publicKey string, keyID string) (*httptest.Server, chan bool) {
	done := make(chan bool)
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/plugins/ci/keys" {
			w.WriteHeader(http.StatusOK)
			data := struct {
				Items []ManifestKeys `json:"items"`
			}{
				Items: []ManifestKeys{{PublicKey: publicKey, KeyID: keyID}},
			}
			b, err := json.Marshal(data)
			if err != nil {
				t.Fatal(err)
			}
			_, err = w.Write(b)
			if err != nil {
				t.Fatal(err)
			}
			require.NoError(t, err)
			done <- true
			return
		}
		w.WriteHeader(http.StatusNotFound)
		done <- true
	})), done
}

// errKeyStore is a minimal plugins.KeyStore that returns a fixed error from
// GetLastUpdated and ListKeys, used to exercise error paths in Run and ensureKeys.
type errKeyStore struct {
	getLastUpdatedErr error
	listKeysErr       error
	setErr            error
	inner             plugins.KeyStore
}

func (e *errKeyStore) Get(ctx context.Context, key string) (string, bool, error) {
	if e.inner != nil {
		return e.inner.Get(ctx, key)
	}
	return "", false, nil
}

func (e *errKeyStore) Set(ctx context.Context, key string, value any) error {
	if e.setErr != nil {
		return e.setErr
	}
	if e.inner != nil {
		return e.inner.Set(ctx, key, value)
	}
	return nil
}

func (e *errKeyStore) Delete(ctx context.Context, key string) error {
	if e.inner != nil {
		return e.inner.Delete(ctx, key)
	}
	return nil
}

func (e *errKeyStore) ListKeys(ctx context.Context) ([]string, error) {
	if e.listKeysErr != nil {
		return nil, e.listKeysErr
	}
	if e.inner != nil {
		return e.inner.ListKeys(ctx)
	}
	return nil, nil
}

func (e *errKeyStore) GetLastUpdated(ctx context.Context) (time.Time, error) {
	if e.getLastUpdatedErr != nil {
		return time.Time{}, e.getLastUpdatedErr
	}
	if e.inner != nil {
		return e.inner.GetLastUpdated(ctx)
	}
	return time.Time{}, nil
}

func (e *errKeyStore) SetLastUpdated(ctx context.Context) error {
	if e.inner != nil {
		return e.inner.SetLastUpdated(ctx)
	}
	return nil
}

func Test_IsDisabled(t *testing.T) {
	t.Run("disabled when PluginSkipPublicKeyDownload is true", func(t *testing.T) {
		kr := ProvideService(&setting.Cfg{PluginSkipPublicKeyDownload: true}, nil)
		require.True(t, kr.IsDisabled())
	})

	t.Run("enabled when PluginSkipPublicKeyDownload is false", func(t *testing.T) {
		kr := ProvideService(&setting.Cfg{PluginSkipPublicKeyDownload: false}, nil)
		require.False(t, kr.IsDisabled())
	})
}

func Test_PublicKeyUpdate(t *testing.T) {
	t.Run("it should retrieve an API key", func(t *testing.T) {
		cfg := &setting.Cfg{}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			_ = v.Run(ctx)
		}()
		<-done

		// wait for the lock to be free
		v.lock.Lock()
		defer v.lock.Unlock()
		res, found, err := v.kv.Get(context.Background(), "7e4d0c6a708866e7")
		require.NoError(t, err)
		require.Equal(t, true, found)
		require.Equal(t, expectedKey, res)
	})

	t.Run("it should update the latest update date", func(t *testing.T) {
		cfg := &setting.Cfg{}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			_ = v.Run(ctx)
		}()
		<-done

		// wait for the lock to be free
		v.lock.Lock()
		defer v.lock.Unlock()
		ti, err := v.kv.GetLastUpdated(context.Background())
		require.NoError(t, err)
		require.Less(t, time.Time{}, ti)
	})

	t.Run("it should remove old keys", func(t *testing.T) {
		cfg := &setting.Cfg{}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "other")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			_ = v.Run(ctx)
		}()
		<-done

		// wait for the lock to be free
		v.lock.Lock()
		defer v.lock.Unlock()
		_, found, err := v.kv.Get(context.Background(), "7e4d0c6a708866e7")
		require.NoError(t, err)
		require.Equal(t, false, found)

		res, found, err := v.kv.Get(context.Background(), "other")
		require.NoError(t, err)
		require.Equal(t, true, found)
		require.Equal(t, expectedKey, res)
	})

	t.Run("it should force-download the key", func(t *testing.T) {
		cfg := &setting.Cfg{
			PluginForcePublicKeyDownload: true,
		}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		// Simulate an updated key
		err := v.kv.SetLastUpdated(context.Background())
		require.NoError(t, err)
		go func() {
			_ = v.Run(ctx)
		}()
		<-done

		// wait for the lock to be free
		v.lock.Lock()
		defer v.lock.Unlock()
		res, found, err := v.kv.Get(context.Background(), "7e4d0c6a708866e7")
		require.NoError(t, err)
		require.Equal(t, true, found)
		require.Equal(t, expectedKey, res)
	})

	t.Run("it should exit cleanly on context cancellation", func(t *testing.T) {
		cfg := &setting.Cfg{}
		s, done := setFakeAPIServer(t, "fake", "7e4d0c6a708866e7")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		ctx, cancel := context.WithCancel(context.Background())
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))

		errCh := make(chan error, 1)
		go func() {
			errCh <- v.Run(ctx)
		}()
		<-done
		cancel()
		err := <-errCh
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("it should return error when key store is unavailable on startup", func(t *testing.T) {
		cfg := &setting.Cfg{}
		storeErr := errors.New("store unavailable")
		v := ProvideService(cfg, &errKeyStore{getLastUpdatedErr: storeErr})
		err := v.Run(context.Background())
		require.ErrorIs(t, err, storeErr)
	})
}

func Test_EnsureKeys(t *testing.T) {
	t.Run("it should return error when listing keys fails", func(t *testing.T) {
		cfg := &setting.Cfg{}
		storeErr := errors.New("list error")
		v := ProvideService(cfg, &errKeyStore{listKeysErr: storeErr})
		err := v.ensureKeys(context.Background())
		require.ErrorIs(t, err, storeErr)
	})

	t.Run("it should return error when storing default key fails", func(t *testing.T) {
		cfg := &setting.Cfg{}
		storeErr := errors.New("set error")
		// listKeysErr is nil so ListKeys returns empty slice, triggering the Set path
		v := ProvideService(cfg, &errKeyStore{setErr: storeErr})
		err := v.ensureKeys(context.Background())
		require.ErrorIs(t, err, storeErr)
	})
}
