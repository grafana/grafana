package manifestverifier

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/ProtonMail/go-crypto/openpgp/clearsign"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
)

func Test_Verify(t *testing.T) {
	t.Run("it should verify a manifest with the default key", func(t *testing.T) {
		v := New(&config.Cfg{}, log.New("test"), kvstore.WithNamespace(kvstore.NewFakeKVStore(), 0, ""))

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

	t.Run("it should verify a manifest with the API key", func(t *testing.T) {
		cfg := &config.Cfg{
			Features: featuremgmt.WithFeatures([]interface{}{"pluginsAPIManifestKey"}...),
		}
		v := New(cfg, log.New("test"), kvstore.WithNamespace(kvstore.NewFakeKVStore(), 0, ""))
		apiCalled := false
		s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/plugins/ci/keys" {
				w.WriteHeader(http.StatusOK)
				data := struct {
					Items []ManifestKeys `json:"items"`
				}{
					Items: []ManifestKeys{{PublicKey: publicKeyText, KeyID: "7e4d0c6a708866e7"}},
				}
				b, err := json.Marshal(data)
				require.NoError(t, err)
				_, err = w.Write(b)
				require.NoError(t, err)
				apiCalled = true
				return
			}
			w.WriteHeader(http.StatusNotFound)
		}))
		cfg.GrafanaComURL = s.URL

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
		require.Equal(t, true, apiCalled)
	})
}
