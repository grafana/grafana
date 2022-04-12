package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func Test_GetPluginAssets(t *testing.T) {
	pluginID := "test-plugin"
	pluginDir := "."
	tmpFile, err := ioutil.TempFile(pluginDir, "")
	require.NoError(t, err)
	tmpFileInParentDir, err := ioutil.TempFile("..", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err := os.RemoveAll(tmpFile.Name())
		assert.NoError(t, err)
		err = os.RemoveAll(tmpFileInParentDir.Name())
		assert.NoError(t, err)
	})
	expectedBody := "Plugin test"
	_, err = tmpFile.WriteString(expectedBody)
	assert.NoError(t, err)

	requestedFile := filepath.Clean(tmpFile.Name())

	t.Run("Given a request for an existing plugin file that is listed as a signature covered file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
			SignedFiles: map[string]struct{}{
				requestedFile: {},
			},
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logger{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Empty(t, l.warnings)
			})
	})

	t.Run("Given a request for a relative path", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logger{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, tmpFileInParentDir.Name())
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 404, sc.resp.Code)
			})
	})

	t.Run("Given a request for an existing plugin file that is not listed as a signature covered file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logger{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Empty(t, l.warnings)
			})
	})

	t.Run("Given a request for an non-existing plugin file", func(t *testing.T) {
		p := plugins.PluginDTO{
			JSONData: plugins.JSONData{
				ID: pluginID,
			},
			PluginDir: pluginDir,
		}
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: p,
			},
		}
		l := &logger{}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				require.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, "Plugin file not found", respJson["message"])
				assert.Empty(t, l.warnings)
			})
	})

	t.Run("Given a request for an non-existing plugin", func(t *testing.T) {
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{},
		}
		l := &logger{}

		requestedFile := "nonExistent"
		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				var respJson map[string]interface{}
				err := json.NewDecoder(sc.resp.Body).Decode(&respJson)
				require.NoError(t, err)
				assert.Equal(t, 404, sc.resp.Code)
				assert.Equal(t, "Plugin not found", respJson["message"])
				assert.Empty(t, l.warnings)
			})
	})

	t.Run("Given a request for a core plugin's file", func(t *testing.T) {
		service := &fakePluginStore{
			plugins: map[string]plugins.PluginDTO{
				pluginID: {
					Class: plugins.Core,
				},
			},
		}
		l := &logger{}

		url := fmt.Sprintf("/public/plugins/%s/%s", pluginID, requestedFile)
		pluginAssetScenario(t, "When calling GET on", url, "/public/plugins/:pluginId/*", service, l,
			func(sc *scenarioContext) {
				callGetPluginAsset(sc)

				require.Equal(t, 200, sc.resp.Code)
				assert.Equal(t, expectedBody, sc.resp.Body.String())
				assert.Empty(t, l.warnings)
			})
	})
}

func TestMakePluginResourceRequest(t *testing.T) {
	pluginClient := &fakePluginClient{}
	hs := HTTPServer{
		Cfg:          setting.NewCfg(),
		log:          log.New(),
		pluginClient: pluginClient,
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	resp := httptest.NewRecorder()
	pCtx := backend.PluginContext{}
	err := hs.makePluginResourceRequest(resp, req, pCtx)
	require.NoError(t, err)

	for {
		if resp.Flushed {
			break
		}
	}

	require.Equal(t, "sandbox", resp.Header().Get("Content-Security-Policy"))
}

func callGetPluginAsset(sc *scenarioContext) {
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func pluginAssetScenario(t *testing.T, desc string, url string, urlPattern string, pluginStore plugins.Store,
	logger log.Logger, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:         setting.NewCfg(),
			pluginStore: pluginStore,
			log:         logger,
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = func(c *models.ReqContext) {
			sc.context = c
			hs.getPluginAssets(c)
		}

		sc.m.Get(urlPattern, sc.defaultHandler)

		fn(sc)
	})
}

type logger struct {
	log.Logger

	warnings []string
}

func (l *logger) Warn(msg string, ctx ...interface{}) {
	l.warnings = append(l.warnings, msg)
}

type fakePluginClient struct {
	plugins.Client

	req *backend.CallResourceRequest
}

func (c *fakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	c.req = req
	bytes, err := json.Marshal(map[string]interface{}{
		"message": "hello",
	})
	if err != nil {
		return err
	}

	return sender.Send(&backend.CallResourceResponse{
		Status:  http.StatusOK,
		Headers: make(map[string][]string),
		Body:    bytes,
	})
}
