package dynamic

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
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

func Test_PublicKeyUpdate(t *testing.T) {
	t.Run("it should retrieve an API key", func(t *testing.T) {
		cfg := &setting.Cfg{}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComAPIURL = s.URL + "/api"
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			err := v.Run(context.Background())
			require.NoError(t, err)
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
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			err := v.Run(context.Background())
			require.NoError(t, err)
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
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		go func() {
			err := v.Run(context.Background())
			require.NoError(t, err)
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
		v := ProvideService(cfg, keystore.ProvideService(kvstore.NewFakeKVStore()))
		// Simulate an updated key
		err := v.kv.SetLastUpdated(context.Background())
		require.NoError(t, err)
		go func() {
			err := v.Run(context.Background())
			require.NoError(t, err)
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
}
