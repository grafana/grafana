package signature

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	publicKey    = ""
	manifestText = []byte{}
)

func setup() {
	if publicKey == "" {
		publicKeyB, err := os.ReadFile("../testdata/manifest/key.pub")
		if err != nil {
			panic(err)
		}
		publicKey = string(publicKeyB)
	}

	if len(manifestText) == 0 {
		var err error
		manifestText, err = os.ReadFile("../testdata/manifest/plugin/MANIFEST.txt")
		if err != nil {
			panic(err)
		}
	}
}

func TestReadPluginManifest(t *testing.T) {
	setup()
	const manifestV1 = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "plugin": "grafana-googlesheets-datasource",
  "version": "1.0.0-dev",
  "files": {
    "LICENSE": "7df059597099bb7dcf25d2a9aedfaf4465f72d8d",
    "README.md": "08ec6d704b6115bef57710f6d7e866c050cb50ee",
    "gfx_sheets_darwin_amd64": "1b8ae92c6e80e502bb0bf2d0ae9d7223805993ab",
    "gfx_sheets_linux_amd64": "f39e0cc7344d3186b1052e6d356eecaf54d75b49",
    "gfx_sheets_windows_amd64.exe": "c8825dfec512c1c235244f7998ee95182f9968de",
    "module.js": "aaec6f51a995b7b843b843cd14041925274d960d",
    "module.js.LICENSE.txt": "7f822fe9341af8f82ad1b0c69aba957822a377cf",
    "module.js.map": "c5a524f5c4237f6ed6a016d43cd46938efeadb45",
    "plugin.json": "55556b845e91935cc48fae3aa67baf0f22694c3f"
  },
  "time": 1586817677115,
  "keyId": "7e4d0c6a708866e7"
}
-----BEGIN PGP SIGNATURE-----

iQGzBAEBCgAdFiEExTyEKBsqv3uNtl8uLGhg/Q+lZ+cFAmQ2lRMACgkQLGhg/Q+l
Z+dzcAv9E2AUY6j1RixUv9h8aHyFeD00Mi37cM0xnTV5+TxKTHnEZnxqLDbz7PfT
sPzyr3Z8hOrr1CDGia6MAYR4qzmbA0z/vl9MgqIKoUJRmZ6H9B3cVWO2Bt+3WvLS
VpPMtpelFbMAtH6lLz8ieJp1RhY/Zdv1yCEwkx7BlvJcqb2JNbK44pv7LexRsOOw
08pbmeLpkxC95HqDZRq11e66jllvq3AkKLU5F76yZHWAjfnok2H2b9jbpQMOEyJz
rpSMKrm9/dATN3RgXdfsBLbm8cpuJnMNg+lTfojGP93x8GSSiVAYeOHKS6NxZpDE
B8i/tmRKdjpn0P+iyGqDMRgyAMMNGMN+vVLvIxVsR6JGkWgN3Y8HtK/wHER2mnu0
T5iCHVLgj+J5/SBC03XeNa2GKPICjDddsppm0fPWuF05yW9HIiChpl87gpwkFGDs
b2C9GFIq+zEWCn7WvMqkGljGCDIHnVjaX+CF0+uk3rsfOEyvdvYKBJSPOUltXeau
/f8HqfVd
=smd7
-----END PGP SIGNATURE-----`

	t.Run("valid manifest", func(t *testing.T) {
		manifest, err := ReadPluginManifest([]byte(manifestV1), publicKey)

		require.NoError(t, err)
		require.NotNil(t, manifest)
		assert.Equal(t, "grafana-googlesheets-datasource", manifest.Plugin)
		assert.Equal(t, "1.0.0-dev", manifest.Version)
		assert.Equal(t, int64(1586817677115), manifest.Time)
		assert.Equal(t, "7e4d0c6a708866e7", manifest.KeyID)
		expectedFiles := []string{"LICENSE", "README.md", "gfx_sheets_darwin_amd64", "gfx_sheets_linux_amd64",
			"gfx_sheets_windows_amd64.exe", "module.js", "module.js.LICENSE.txt", "module.js.map", "plugin.json",
		}
		assert.Equal(t, expectedFiles, fileList(manifest))
	})

	t.Run("invalid manifest", func(t *testing.T) {
		modified := strings.ReplaceAll(manifestV1, "README.md", "xxxxxxxxxx")
		_, err := ReadPluginManifest([]byte(modified), publicKey)
		require.Error(t, err)
	})
}

func TestReadPluginManifestV2(t *testing.T) {
	setup()

	t.Run("valid manifest", func(t *testing.T) {
		manifest, err := ReadPluginManifest(manifestText, publicKey)

		require.NoError(t, err)
		require.NotNil(t, manifest)
		assert.Equal(t, "test-datasource", manifest.Plugin)
		assert.Equal(t, "1.0.0", manifest.Version)
		assert.Equal(t, int64(1661171059101), manifest.Time)
		assert.Equal(t, "7e4d0c6a708866e7", manifest.KeyID)
		assert.Equal(t, "2.0.0", manifest.ManifestVersion)
		assert.Equal(t, plugins.GrafanaSignature, manifest.SignatureType)
		assert.Equal(t, "grafana", manifest.SignedByOrg)
		assert.Equal(t, "Grafana Labs", manifest.SignedByOrgName)
		assert.Equal(t, []string{"http://localhost:3000/"}, manifest.RootURLs)
		assert.Equal(t, []string{"plugin.json"}, fileList(manifest))
	})
}

func TestCalculate(t *testing.T) {
	t.Run("Validate root URL against App URL for non-private plugin if is specified in manifest", func(t *testing.T) {
		tcs := []struct {
			appURL            string
			expectedSignature plugins.Signature
		}{
			{
				appURL: "https://dev.grafana.com",
				expectedSignature: plugins.Signature{
					Status:     plugins.SignatureInvalid,
					Type:       "",
					SigningOrg: "",
				},
			},
			{
				appURL: "https://non.matching.url.com",
				expectedSignature: plugins.Signature{
					Status: plugins.SignatureInvalid,
				},
			},
		}

		parentDir, err := filepath.Abs("../")
		if err != nil {
			t.Errorf("could not construct absolute path of current dir")
			return
		}

		for _, tc := range tcs {
			origAppURL := setting.AppUrl
			t.Cleanup(func() {
				setting.AppUrl = origAppURL
			})
			setting.AppUrl = tc.appURL

			basePath := filepath.Join(parentDir, "testdata/non-pvt-with-root-url/plugin")
			sig, err := Calculate(context.Background(), log.NewTestLogger(), &fakes.FakePluginSource{
				PluginClassFunc: func(ctx context.Context) plugins.Class {
					return plugins.External
				},
			}, plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "test-datasource",
					Info: plugins.Info{
						Version: "1.0.0",
					},
				},
				FS: plugins.NewLocalFS(map[string]struct{}{
					filepath.Join(basePath, "MANIFEST.txt"): {},
					filepath.Join(basePath, "plugin.json"):  {},
				}, basePath),
			}, publicKey)
			require.NoError(t, err)
			require.Equal(t, tc.expectedSignature, sig)
		}
	})

	t.Run("Unsigned Chromium file should not invalidate signature for Renderer plugin running on Windows", func(t *testing.T) {
		backup := runningWindows
		t.Cleanup(func() {
			runningWindows = backup
		})

		basePath := "../testdata/renderer-added-file/plugin"

		runningWindows = true
		sig, err := Calculate(context.Background(), log.NewTestLogger(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
		}, plugins.FoundPlugin{
			JSONData: plugins.JSONData{
				ID:   "test-renderer",
				Type: plugins.Renderer,
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
			FS: plugins.NewLocalFS(map[string]struct{}{
				filepath.Join(basePath, "MANIFEST.txt"):         {},
				filepath.Join(basePath, "plugin.json"):          {},
				filepath.Join(basePath, "chrome-win/debug.log"): {},
			}, basePath),
		}, publicKey)
		require.NoError(t, err)
		require.Equal(t, plugins.Signature{
			Status:     plugins.SignatureInvalid,
			Type:       "",
			SigningOrg: "",
		}, sig)
	})

	t.Run("Signature verification should work with any path separator", func(t *testing.T) {
		var toSlashUnix = newToSlash('/')
		var toSlashWindows = newToSlash('\\')

		for _, tc := range []struct {
			name    string
			sep     string
			toSlash func(string) string
		}{
			{"unix", "/", toSlashUnix},
			{"windows", "\\", toSlashWindows},
		} {
			t.Run(tc.name, func(t *testing.T) {
				// Replace toSlash for cross-platform testing
				oldToSlash := toSlash
				t.Cleanup(func() {
					toSlash = oldToSlash
				})
				toSlash = tc.toSlash

				basePath := "../testdata/app-with-child/dist"

				sig, err := Calculate(context.Background(), log.NewTestLogger(), &fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return plugins.External
					},
				}, plugins.FoundPlugin{
					JSONData: plugins.JSONData{
						ID:   "myorgid-simple-app",
						Type: plugins.App,
						Info: plugins.Info{
							Version: "%VERSION%",
						},
					},
					FS: newPathSeparatorOverrideFS(tc.sep, map[string]struct{}{
						filepath.Join(basePath, "MANIFEST.txt"):      {},
						filepath.Join(basePath, "plugin.json"):       {},
						filepath.Join(basePath, "child/plugin.json"): {},
					}, basePath),
				}, publicKey)
				require.NoError(t, err)
				require.Equal(t, plugins.Signature{
					Status:     plugins.SignatureInvalid,
					Type:       "",
					SigningOrg: "",
				}, sig)
			})
		}
	})
}

// newToSlash returns a new function that acts as filepath.ToSlash but for the specified os-separator.
// This can be used to test filepath.ToSlash-dependant code cross-platform.
func newToSlash(sep rune) func(string) string {
	return func(path string) string {
		if sep == '/' {
			return path
		}
		return strings.ReplaceAll(path, string(sep), "/")
	}
}

func TestNewToSlash(t *testing.T) {
	t.Run("unix", func(t *testing.T) {
		toSlashUnix := newToSlash('/')
		require.Equal(t, "folder", toSlashUnix("folder"))
		require.Equal(t, "/folder", toSlashUnix("/folder"))
		require.Equal(t, "/folder/file", toSlashUnix("/folder/file"))
		require.Equal(t, "/folder/other\\file", toSlashUnix("/folder/other\\file"))
	})

	t.Run("windows", func(t *testing.T) {
		toSlashWindows := newToSlash('\\')
		require.Equal(t, "folder", toSlashWindows("folder"))
		require.Equal(t, "C:/folder", toSlashWindows("C:\\folder"))
		require.Equal(t, "folder/file.exe", toSlashWindows("folder\\file.exe"))
	})
}

// fsPathSeparatorFiles embeds plugins.LocalFS and overrides the Files() behaviour so all the returned elements
// have the specified path separator. This can be used to test Files() behaviour cross-platform.
type fsPathSeparatorFiles struct {
	plugins.LocalFS

	separator string
}

// newPathSeparatorOverrideFS returns a new fsPathSeparatorFiles. Sep is the separator that will be used ONLY for
// the elements returned by Files(). Files and basePath MUST use the os-specific path separator (filepath.Separator)
// if Open() is required to work for the test case.
func newPathSeparatorOverrideFS(sep string, files map[string]struct{}, basePath string) fsPathSeparatorFiles {
	return fsPathSeparatorFiles{
		LocalFS:   plugins.NewLocalFS(files, basePath),
		separator: sep,
	}
}

// Files returns LocalFS.Files(), but all path separators (filepath.Separator) are replaced with f.separator.
func (f fsPathSeparatorFiles) Files() []string {
	files := f.LocalFS.Files()
	const osSepStr = string(filepath.Separator)
	for i := 0; i < len(files); i++ {
		files[i] = strings.ReplaceAll(files[i], osSepStr, f.separator)
	}
	return files
}

func TestFSPathSeparatorFiles(t *testing.T) {
	for _, tc := range []struct {
		name string
		sep  string
	}{
		{"unix", "/"},
		{"windows", "\\"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fs := newPathSeparatorOverrideFS("/", map[string]struct{}{
				"a": {},
				strings.Join([]string{"a", "b", "c"}, tc.sep): {},
			}, ".")
			files := fs.Files()
			filesMap := make(map[string]struct{}, len(files))
			// Re-convert to map as the key order is not stable
			for _, f := range files {
				filesMap[f] = struct{}{}
			}
			require.Equal(t, filesMap, map[string]struct{}{"a": {}, strings.Join([]string{"a", "b", "c"}, tc.sep): {}})
		})
	}
}

func fileList(manifest *PluginManifest) []string {
	var keys []string
	for k := range manifest.Files {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func Test_urlMatch_privateGlob(t *testing.T) {
	type args struct {
		specs  []string
		target string
	}
	tests := []struct {
		name        string
		args        args
		shouldMatch bool
	}{
		{
			name: "Support single wildcard matching single subdomain",
			args: args{
				specs:  []string{"https://*.example.com"},
				target: "https://test.example.com",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support single wildcard matching multiple subdomains",
			args: args{
				specs:  []string{"https://*.example.com"},
				target: "https://more.test.example.com",
			},
			shouldMatch: false,
		},
		{
			name: "Support multiple wildcards matching multiple subdomains",
			args: args{
				specs:  []string{"https://**.example.com"},
				target: "https://test.example.com",
			},
			shouldMatch: true,
		},
		{
			name: "Support multiple wildcards matching multiple subdomains",
			args: args{
				specs:  []string{"https://**.example.com"},
				target: "https://more.test.example.com",
			},
			shouldMatch: true,
		},
		{
			name: "Support single wildcard matching single paths",
			args: args{
				specs:  []string{"https://www.example.com/*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support single wildcard matching multiple paths",
			args: args{
				specs:  []string{"https://www.example.com/*"},
				target: "https://www.example.com/other/grafana",
			},
			shouldMatch: false,
		},
		{
			name: "Support double wildcard matching multiple paths",
			args: args{
				specs:  []string{"https://www.example.com/**"},
				target: "https://www.example.com/other/grafana",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support subdomain mismatch",
			args: args{
				specs:  []string{"https://www.test.example.com/grafana/docs"},
				target: "https://www.dev.example.com/grafana/docs",
			},
			shouldMatch: false,
		},
		{
			name: "Support single wildcard matching single path",
			args: args{
				specs:  []string{"https://www.example.com/grafana*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support single wildcard matching different path prefix",
			args: args{
				specs:  []string{"https://www.example.com/grafana*"},
				target: "https://www.example.com/somethingelse",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support path mismatch",
			args: args{
				specs:  []string{"https://example.com/grafana"},
				target: "https://example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Support both domain and path wildcards",
			args: args{
				specs:  []string{"https://*.example.com/*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support wildcards without TLDs",
			args: args{
				specs:  []string{"https://example.*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Support exact match",
			args: args{
				specs:  []string{"https://example.com/test"},
				target: "https://example.com/test",
			},
			shouldMatch: true,
		},
		{
			name: "Does not support scheme mismatch",
			args: args{
				specs:  []string{"https://test.example.com/grafana"},
				target: "http://test.example.com/grafana",
			},
			shouldMatch: false,
		},
		{
			name: "Support trailing slash in spec",
			args: args{
				specs:  []string{"https://example.com/"},
				target: "https://example.com",
			},
			shouldMatch: true,
		},
		{
			name: "Support trailing slash in target",
			args: args{
				specs:  []string{"https://example.com"},
				target: "https://example.com/",
			},
			shouldMatch: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := urlMatch(tt.args.specs, tt.args.target, plugins.PrivateGlobSignature)
			require.NoError(t, err)
			require.Equal(t, tt.shouldMatch, got)
		})
	}
}

func Test_urlMatch_private(t *testing.T) {
	type args struct {
		specs  []string
		target string
	}
	tests := []struct {
		name        string
		args        args
		shouldMatch bool
	}{
		{
			name: "Support exact match",
			args: args{
				specs:  []string{"https://example.com/test"},
				target: "https://example.com/test",
			},
			shouldMatch: true,
		},
		{
			name: "Support trailing slash in spec",
			args: args{
				specs:  []string{"https://example.com/test/"},
				target: "https://example.com/test",
			},
			shouldMatch: true,
		},
		{
			name: "Support trailing slash in target",
			args: args{
				specs:  []string{"https://example.com/test"},
				target: "https://example.com/test/",
			},
			shouldMatch: true,
		},
		{
			name: "Do not support single wildcard matching single subdomain",
			args: args{
				specs:  []string{"https://*.example.com"},
				target: "https://test.example.com",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support multiple wildcards matching multiple subdomains",
			args: args{
				specs:  []string{"https://**.example.com"},
				target: "https://more.test.example.com",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support single wildcard matching single paths",
			args: args{
				specs:  []string{"https://www.example.com/*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support double wildcard matching multiple paths",
			args: args{
				specs:  []string{"https://www.example.com/**"},
				target: "https://www.example.com/other/grafana",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support subdomain mismatch",
			args: args{
				specs:  []string{"https://www.test.example.com/grafana/docs"},
				target: "https://www.dev.example.com/grafana/docs",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support path mismatch",
			args: args{
				specs:  []string{"https://example.com/grafana"},
				target: "https://example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support both domain and path wildcards",
			args: args{
				specs:  []string{"https://*.example.com/*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support wildcards without TLDs",
			args: args{
				specs:  []string{"https://example.*"},
				target: "https://www.example.com/grafana1",
			},
			shouldMatch: false,
		},
		{
			name: "Do not support scheme mismatch",
			args: args{
				specs:  []string{"https://test.example.com/grafana"},
				target: "http://test.example.com/grafana",
			},
			shouldMatch: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := urlMatch(tt.args.specs, tt.args.target, plugins.PrivateSignature)
			require.NoError(t, err)
			require.Equal(t, tt.shouldMatch, got)
		})
	}
}

func Test_validateManifest(t *testing.T) {
	tcs := []struct {
		name        string
		manifest    *PluginManifest
		expectedErr string
	}{
		{
			name:        "Empty plugin field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.Plugin = "" }),
			expectedErr: "valid manifest field plugin is required",
		},
		{
			name:        "Empty keyId field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.KeyID = "" }),
			expectedErr: "valid manifest field keyId is required",
		},
		{
			name:        "Empty signedByOrg field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.SignedByOrg = "" }),
			expectedErr: "valid manifest field signedByOrg is required",
		},
		{
			name:        "Empty signedByOrgName field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.SignedByOrgName = "" }),
			expectedErr: "valid manifest field SignedByOrgName is required",
		},
		{
			name:        "Empty signatureType field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.SignatureType = "" }),
			expectedErr: "valid manifest field signatureType is required",
		},
		{
			name:        "Invalid signatureType field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.SignatureType = "invalidSignatureType" }),
			expectedErr: "valid manifest field signatureType is required",
		},
		{
			name:        "Empty files field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.Files = map[string]string{} }),
			expectedErr: "valid manifest field files is required",
		},
		{
			name:        "Empty time field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.Time = 0 }),
			expectedErr: "valid manifest field time is required",
		},
		{
			name:        "Empty version field",
			manifest:    createV2Manifest(t, func(m *PluginManifest) { m.Version = "" }),
			expectedErr: "valid manifest field version is required",
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			err := validateManifest(*tc.manifest, nil, publicKey)
			require.Errorf(t, err, tc.expectedErr)
		})
	}
}

func createV2Manifest(t *testing.T, cbs ...func(*PluginManifest)) *PluginManifest {
	t.Helper()

	m := &PluginManifest{
		Plugin:  "grafana-test-app",
		Version: "2.5.3",
		KeyID:   "7e4d0c6a708866e7",
		Time:    1586817677115,
		Files: map[string]string{
			"plugin.json": "55556b845e91935cc48fae3aa67baf0f22694c3f",
		},
		ManifestVersion: "2.0.0",
		SignatureType:   plugins.GrafanaSignature,
		SignedByOrg:     "grafana",
		SignedByOrgName: "grafana",
	}

	for _, cb := range cbs {
		cb(m)
	}

	return m
}
