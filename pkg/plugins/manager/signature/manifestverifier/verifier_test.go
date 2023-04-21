package manifestverifier

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp/clearsign"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/keystore"
	"github.com/stretchr/testify/require"
)

func Test_Verify(t *testing.T) {
	t.Run("it should verify a manifest with the default key", func(t *testing.T) {
		v := New(&config.Cfg{}, log.New("test"), keystore.ProvideService(kvstore.NewFakeKVStore()))

		body, err := os.ReadFile("../../testdata/test-app/MANIFEST.txt")
		if err != nil {
			t.Fatal(err)
		}

		block, _ := clearsign.Decode(body)
		if block == nil {
			t.Fatal("failed to decode")
		}

		err = v.Verify("7e4d0c6a708866e7", block)
		require.NoError(t, err)
	})
}

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
	t.Run("it should verify a manifest with the API key", func(t *testing.T) {
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures([]interface{}{"pluginsAPIManifestKey"}...),
		}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComURL = s.URL
		v := New(cfg, log.New("test"), keystore.ProvideService(kvstore.NewFakeKVStore()))
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
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures([]interface{}{"pluginsAPIManifestKey"}...),
		}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "7e4d0c6a708866e7")
		cfg.GrafanaComURL = s.URL
		v := New(cfg, log.New("test"), keystore.ProvideService(kvstore.NewFakeKVStore()))
		<-done

		// wait for the lock to be free
		v.lock.Lock()
		defer v.lock.Unlock()
		ti := v.kv.GetLastUpdated(context.Background())
		require.Less(t, time.Time{}, ti)
	})

	t.Run("it should remove old keys", func(t *testing.T) {
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures([]interface{}{"pluginsAPIManifestKey"}...),
		}
		expectedKey := "fake"
		s, done := setFakeAPIServer(t, expectedKey, "other")
		cfg.GrafanaComURL = s.URL
		v := New(cfg, log.New("test"), keystore.ProvideService(kvstore.NewFakeKVStore()))
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
}
