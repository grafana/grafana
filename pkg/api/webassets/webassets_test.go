package webassets

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGetWebAssetsBuildDir(t *testing.T) {
	cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata"}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")

	assets, err := GetWebAssets(context.Background(), BuildDir, cfg, license)
	require.NoError(t, err)
	require.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
	require.Equal(t, "public/build/grafana.dark.dddd3333eeee4444ffff.css", assets.Dark)
}

func TestGetWebAssetsSwagger(t *testing.T) {
	cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata"}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")

	assets, err := GetWebAssets(context.Background(), "build-swagger", cfg, license)
	require.NoError(t, err)
	require.Equal(t, "public/build-swagger/runtime.js", assets.JSFiles[0].FilePath)
}

func TestGetWebAssetsMissingBuildDir(t *testing.T) {
	cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata"}
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")

	assets, err := GetWebAssets(context.Background(), "build-does-not-exist", cfg, license)
	require.ErrorContains(t, err, "failed to load assets-manifest.json")
	require.Nil(t, assets)
}

func TestReadWebassets(t *testing.T) {
	assets, err := ReadWebAssetsFromFile("testdata/assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	// fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
	"jsFiles": [
		{
		"filePath": "public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "public/build/default-packages_grafana-ui_src_components_Layout_Stack_Stack_tsx-packages_grafana-ui_src_com-2a3620.js",
		"integrity": "sha256-+0bPuBGKFGglkXvW4oPiolrNveozRLZVLUrbCYsbVcM= sha384-EIayAgykdDWmyilAuXo4ad96v3tRqdWZp+BHdeDpSSsbAMeg+eoBBbk2Yh219kDg sha512-+jn7kmQ9Id8aTIe66TD+vM+W19cTIVexEfkxbxgqXdJyJ72qalN6ccWyP1ro1w/E1R/laZGNLz1LBc1I4u2Isw=="
		},
		{
		"filePath": "public/build/app.js",
		"integrity": "sha256-IOZKp3piC3vddDXP5jy5rIw0vb0KKEOg/k9EGrIxskk= sha384-CBNr5W0pJ23LQMnz5BZI1iVBIExOmF/wpqkEnBtYu9R/yYJIzjpv8KT0a3TBulOi sha512-ockzlzgosuZvLittZrSzh8lexEIZF9iKpy6J9Ii4es3e4D34FpWhHJhDZGpxLVraX4ypLofrDp2Yy0sdUbdi7w=="
		}
	],
	"cssFiles": [
		{
		"filePath": "public/build/grafana.app.91aaa9d81398c147a57c.css",
		"integrity": "sha256-77rfikk+dYkH82TOmcmleVoDOHZQdhzVX9gDLcgPbtQ= sha384-IOTlZ1IvTVq5ekKLoaE3/SoZ12K1eExOAnSw9BzkgQ3+RcyQpb1S5hO2w//IIkRB sha512-0Ct3uJBFQIkyxYTvMxseA1cphe2RivXQ2MCbiV0hEm5NzWPiY9sq2P4ay5dXz5v35c++4W47KaknoWlc83bQJQ=="
		}
	],
	"dark": "public/build/grafana.dark.722d809dba5a31f57d49.css",
	"light": "public/build/grafana.light.2fbd901d840329c18394.css"
	}`, string(dto))

	assets.SetContentDeliveryURL("https://grafana-assets.grafana.net/grafana/10.3.0-64123/")

	dto, err = json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
	"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
	"jsFiles": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.js",
		"integrity": "sha256-tM4AGASn3Cb8139+wp3w6rlo3ELFAuUW7K4Pifx226o= sha384-DfxxsYWb0+RxiXOr+wtCSzAAYGecffq/iHyn6CN9tHmaORv1sS+rsrnlnJo2jPQD sha512-qSxdqrx0mJLY1mdkbKrkCyqOoIEgFqzCoY9+uIuFRIVDPFbb2nJy0NtaKMQvDJnAzIrJFwzwW1e250T4WqQNiQ=="
		},
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/default-packages_grafana-ui_src_components_Layout_Stack_Stack_tsx-packages_grafana-ui_src_com-2a3620.js",
		"integrity": "sha256-+0bPuBGKFGglkXvW4oPiolrNveozRLZVLUrbCYsbVcM= sha384-EIayAgykdDWmyilAuXo4ad96v3tRqdWZp+BHdeDpSSsbAMeg+eoBBbk2Yh219kDg sha512-+jn7kmQ9Id8aTIe66TD+vM+W19cTIVexEfkxbxgqXdJyJ72qalN6ccWyP1ro1w/E1R/laZGNLz1LBc1I4u2Isw=="
		},
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.js",
		"integrity": "sha256-IOZKp3piC3vddDXP5jy5rIw0vb0KKEOg/k9EGrIxskk= sha384-CBNr5W0pJ23LQMnz5BZI1iVBIExOmF/wpqkEnBtYu9R/yYJIzjpv8KT0a3TBulOi sha512-ockzlzgosuZvLittZrSzh8lexEIZF9iKpy6J9Ii4es3e4D34FpWhHJhDZGpxLVraX4ypLofrDp2Yy0sdUbdi7w=="
		}
	],
	"cssFiles": [
		{
		"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.app.91aaa9d81398c147a57c.css",
		"integrity": "sha256-77rfikk+dYkH82TOmcmleVoDOHZQdhzVX9gDLcgPbtQ= sha384-IOTlZ1IvTVq5ekKLoaE3/SoZ12K1eExOAnSw9BzkgQ3+RcyQpb1S5hO2w//IIkRB sha512-0Ct3uJBFQIkyxYTvMxseA1cphe2RivXQ2MCbiV0hEm5NzWPiY9sq2P4ay5dXz5v35c++4W47KaknoWlc83bQJQ=="
		}
	],
	"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.722d809dba5a31f57d49.css",
	"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.2fbd901d840329c18394.css"
	}`, string(dto))
}

func TestReadWebassetsFromCDN(t *testing.T) {
	t.Skip()

	assets, err := ReadWebAssetsFromCDN(context.Background(), "build", "https://grafana-assets.grafana.net/grafana/10.3.0-64123/")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
		"jsFiles": [
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.6d702760ddd47772f116.js",
			"integrity": "sha256-6tSxwMwqd9McukcH+i56v1v+8JsVlMXPWKUCIK30yK8= sha384-dfRWJ5QfPAiQKJ9fUugmeXVdRSx8OS3XUdkEyEhxkm9CZQf9KeUyUe6fGV7VL7s9 sha512-0kjFCSBeQtdS3F9B/uqX45KMMUffYpsU7Ve7AYjy75HiBzovxRGG4hWPZD7d4Gha0Y3Oj4AmZA37TJoafptlRQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/7653.f5c70a70add3b711f560.js",
			"integrity": "sha256-p65DYfZPt9NU7vDwlxW+sY9sK+wQ9tJgTGlCJt+LvxY= sha384-P1TDQw3ZJ4X6Fiyn6UpLpVuHq+UW3zKRUM6U0vjucSl/bjFmQJfGR9XE64uEn6sJ sha512-sPqhDs/mWUBL6txtyoTdlgyZvVfdttUAXdV39aEroYpSnl/uEoLIcNBem5mNxoh4ut4TpSb9hlW6tTD7QV07/g=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/182.0b85a6da60c3ae0a9093.js",
			"integrity": "sha256-4vJBytomvJYkSsXlAo7BXDiXRsi5JVWBosIZSMCYlqs= sha384-MWfyWG85/+OvsA4E9CvG1NGiSzrp/EH37Xd/+qfdMFKmvAEGzGx9N/4xF+3N3/yj sha512-j1h6qobFAJYU+7QFdcChEeHa/FPXuArEsHJuXSYtaqrDU7oNHyW1PqFz6kNUwqE674Hutl93EeY+UsUlpZgZZQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/8781.91ede282a7f6078508e7.js",
			"integrity": "sha256-b68VAYMTugwWaHtffKI4qCMSWTN/fg0xQv+MnSILQgg= sha384-ptDkcAAAQhuG9Mhvs6gvGIp0HIjCfAP+ysaMltIr3L5alN6Ki71Si/zO6C70YArC sha512-N5tkcDgTPcNvQymegqnx0syp0kS7wVzPnt7i5KSu/RAi6cfM9XiRfz7bZh6fcZAJxApvpL1OJhUQQwPFFBN4ZA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/3958.1d29ae9e8eb421432f48.js",
			"integrity": "sha256-9c+QGDOI8HtAzVBLA3nJOOU+LzhoENAhIEw7gGSkgWY= sha384-Y05zEdrM/ab9jzGH6segO9GyE8OTV5RvWPZFgynXX4XgvMOyWJcySqwW4RoIVo6P sha512-+ro4iXipgz1zUySd8oMbOY6XX+RjP4gi8bksFNjJGiLQOHVb/EKZKDj5UBeIE96XMd1AoEvZdymCvaft3d8oeA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.18e8d3e07edcc1356a6a.js",
			"integrity": "sha256-ueeH8P/rDaft7jtzRmTN4UpNtiPfhzYa7c1VbBiRLTo= sha384-SijeOWlmIMzm/WNVg5e+yMieef6LOFXMu8d2laBtaY/2m/fviGI+8W55jazWzb+C sha512-qr5MoBZ4wNTCm6aRQ5/mglO8gShmKFpvr066SJgKyAJA4j8cK0snL2XhubUNxND+KkpKAnRe7EjsHYd28/uvkw=="
		  }
		],
		"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.b44253d019cd9cb46428.css",
		"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.e8e11c59b604d62836be.css"
	  }`, string(dto))
}

func TestPublicPathFollowsBuildDir(t *testing.T) {
	tests := []struct {
		buildDir string
		expected string
	}{
		{buildDir: BuildDir, expected: "public/build/"},
		{buildDir: "build-swagger", expected: "public/build-swagger/"},
	}

	for _, tt := range tests {
		t.Run(tt.buildDir, func(t *testing.T) {
			require.Equal(t, tt.expected, PublicPathFor(tt.buildDir))
		})
	}

	t.Run("is set on assets read from disk", func(t *testing.T) {
		cfg := &setting.Cfg{StaticRootPath: "testdata", Env: setting.Dev}
		license := licensingtest.NewFakeLicensing()
		license.On("ContentDeliveryPrefix").Return("grafana")

		assets, err := GetWebAssets(context.Background(), BuildDir, cfg, license)
		require.NoError(t, err)
		require.Equal(t, "public/build/", assets.PublicPath)
	})
}

func TestGetWebAssetsFromDevServer(t *testing.T) {
	license := licensingtest.NewFakeLicensing()
	license.On("ContentDeliveryPrefix").Return("grafana")

	manifest, err := os.ReadFile(filepath.Join("testdata", BuildDir, AssetsManifestFile))
	require.NoError(t, err)

	t.Run("prefixes assets with the dev server origin", func(t *testing.T) {
		var gotPath string
		devServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotPath = r.URL.Path
			_, _ = w.Write(manifest)
		}))
		defer devServer.Close()

		cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata", FrontendDevServerURL: devServer.URL}
		assets, err := GetWebAssets(context.Background(), BuildDir, cfg, license)
		require.NoError(t, err)

		require.Equal(t, "/public/build/"+AssetsManifestFile, gotPath)
		require.Equal(t, devServer.URL+"/", assets.ContentDeliveryURL)
		require.Equal(t, "public/build/", assets.PublicPath)
		require.Equal(t, devServer.URL+"/public/build/runtime.js", assets.JSFiles[0].FilePath)
	})

	t.Run("falls back to the build on disk when the dev server is down", func(t *testing.T) {
		devServer := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
		devServerURL := devServer.URL
		devServer.Close()

		cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata", FrontendDevServerURL: devServerURL}
		assets, err := GetWebAssets(context.Background(), BuildDir, cfg, license)
		require.NoError(t, err)

		require.Empty(t, assets.ContentDeliveryURL)
		require.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
	})

	// The realistic failure is not "nothing is listening" but a dev server that is up and
	// answering wrongly - mid-build, or with a drifted publicPath.
	t.Run("falls back to the build on disk when the dev server answers badly", func(t *testing.T) {
		for name, handler := range map[string]http.HandlerFunc{
			"a 500":      func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) },
			"a 404":      func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNotFound) },
			"not json":   func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("<html>nope</html>")) },
			"no entries": func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`{}`)) },
		} {
			t.Run(name, func(t *testing.T) {
				devServer := httptest.NewServer(handler)
				defer devServer.Close()

				cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata", FrontendDevServerURL: devServer.URL}
				assets, err := GetWebAssets(context.Background(), BuildDir, cfg, license)
				require.NoError(t, err)

				require.Empty(t, assets.ContentDeliveryURL)
				require.Equal(t, "public/build/runtime.js", assets.JSFiles[0].FilePath)
			})
		}
	})

	t.Run("is ignored for the swagger build, which has no dev server", func(t *testing.T) {
		devServer := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Error("the swagger build must not read its manifest from the dev server")
		}))
		defer devServer.Close()

		cfg := &setting.Cfg{Env: setting.Dev, StaticRootPath: "testdata", FrontendDevServerURL: devServer.URL}
		assets, err := GetWebAssets(context.Background(), "build-swagger", cfg, license)
		require.NoError(t, err)
		require.Empty(t, assets.ContentDeliveryURL)
	})
}

func TestReadWebAssetsBounds(t *testing.T) {
	const (
		maxManifestSize = 1024 * 1024
		maxAssets       = 256
		maxIntegrity    = 512
	)
	const manifest = `{"entrypoints":{"app":{"assets":{"js":["public/build/app.js"]}}}}`
	paths := func(n int) []string {
		files := make([]string, n)
		for i := range files {
			files[i] = "public/build/app.js"
		}
		return files
	}
	build := func(mutate func(app, dark, light *EntryPointInfo, m map[string]ManifestInfo)) []byte {
		app, dark, light := &EntryPointInfo{}, &EntryPointInfo{}, &EntryPointInfo{}
		app.Assets.JS = []string{"public/build/app.js"}
		m := map[string]ManifestInfo{"entrypoints": {App: app, Dark: dark, Light: light}}
		mutate(app, dark, light, m)
		data, err := json.Marshal(m)
		require.NoError(t, err)
		return data
	}

	cases := map[string]struct {
		data    []byte
		wantErr bool
	}{
		"at size limit":   {data: []byte(manifest + strings.Repeat(" ", maxManifestSize-len(manifest)))},
		"over size limit": {data: []byte(manifest + strings.Repeat(" ", maxManifestSize+1-len(manifest))), wantErr: true},
		"max app JS and CSS": {data: build(func(app, _, _ *EntryPointInfo, _ map[string]ManifestInfo) {
			app.Assets.JS, app.Assets.CSS = paths(maxAssets/2), paths(maxAssets/2)
		})},
		"too many app JS and CSS": {wantErr: true, data: build(func(app, _, _ *EntryPointInfo, _ map[string]ManifestInfo) {
			app.Assets.JS, app.Assets.CSS = paths(maxAssets/2), paths(maxAssets/2+1)
		})},
		"max integrity": {data: build(func(_, _, _ *EntryPointInfo, m map[string]ManifestInfo) {
			m["app.js"] = ManifestInfo{FilePath: "public/build/app.js", Integrity: strings.Repeat("a", maxIntegrity)}
		})},
		"integrity too long": {wantErr: true, data: build(func(_, _, _ *EntryPointInfo, m map[string]ManifestInfo) {
			m["app.js"] = ManifestInfo{FilePath: "public/build/app.js", Integrity: strings.Repeat("a", maxIntegrity+1)}
		})},
	}
	for name, tt := range cases {
		t.Run(name, func(t *testing.T) {
			assets, err := readWebAssets(bytes.NewReader(tt.data))
			if tt.wantErr {
				require.Error(t, err)
				require.Nil(t, assets)
				return
			}
			require.NoError(t, err)
			require.NotEmpty(t, assets.JSFiles)

			filename := filepath.Join(t.TempDir(), AssetsManifestFile)
			require.NoError(t, os.WriteFile(filename, tt.data, 0600))
			assets, err = ReadWebAssetsFromFile(filename)
			require.NoError(t, err)
			require.NotEmpty(t, assets.JSFiles)
		})
	}

	t.Run("file over size limit", func(t *testing.T) {
		filename := filepath.Join(t.TempDir(), AssetsManifestFile)
		require.NoError(t, os.WriteFile(filename, cases["over size limit"].data, 0600))
		assets, err := ReadWebAssetsFromFile(filename)
		require.Error(t, err)
		require.Nil(t, assets)
	})

	for _, file := range []string{"../app.js", "/public/build/app.js", "public/build/../app.js", "https://example.com/app.js"} {
		for _, location := range []string{"app JS", "app CSS", "dark CSS", "light CSS"} {
			t.Run(fmt.Sprintf("rejects %q in %s", file, location), func(t *testing.T) {
				data := build(func(app, dark, light *EntryPointInfo, _ map[string]ManifestInfo) {
					switch location {
					case "app JS":
						app.Assets.JS = []string{file}
					case "app CSS":
						app.Assets.CSS = []string{file}
					case "dark CSS":
						dark.Assets.CSS = []string{file}
					case "light CSS":
						light.Assets.CSS = []string{file}
					}
				})
				assets, err := readWebAssets(bytes.NewReader(data))
				require.Error(t, err)
				require.Nil(t, assets)
			})
		}
	}

	t.Run("accepts clean relative paths including themes", func(t *testing.T) {
		data := build(func(app, dark, light *EntryPointInfo, _ map[string]ManifestInfo) {
			app.Assets.CSS = []string{"public/build/app.css"}
			dark.Assets.CSS = []string{"public/build/dark.css"}
			light.Assets.CSS = []string{"public/build/light.css"}
		})
		assets, err := readWebAssets(bytes.NewReader(data))
		require.NoError(t, err)
		require.Equal(t, "public/build/dark.css", assets.Dark)
		require.Equal(t, "public/build/light.css", assets.Light)
	})
}
