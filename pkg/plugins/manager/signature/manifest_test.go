package signature

import (
	"context"
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/ProtonMail/go-crypto/openpgp/clearsign"
	openpgpErrors "github.com/ProtonMail/go-crypto/openpgp/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/setting"
)

func TestReadPluginManifest(t *testing.T) {
	txt := `-----BEGIN PGP SIGNED MESSAGE-----
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
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wqEEARMKAAYFAl6U6o0ACgkQfk0ManCIZuevWAIHSvcxOy1SvvL5gC+HpYyG
VbSsUvF2FsCoXUCTQflK6VdJfSPNzm8YdCdx7gNrBdly6HEs06ZaRp44F/ve
NR7DnB0CCQHO+4FlSPtXFTzNepoc+CytQyDAeOLMLmf2Tqhk2YShk+G/YlVX
74uuP5UXZxwK2YKJovdSknDIU7MhfuvvQIP/og==
=hBea
-----END PGP SIGNATURE-----`

	t.Run("valid manifest", func(t *testing.T) {
		s := ProvideService(&config.Cfg{}, statickey.New())
		manifest, err := s.readPluginManifest(context.Background(), []byte(txt))

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
		modified := strings.ReplaceAll(txt, "README.md", "xxxxxxxxxx")
		s := ProvideService(&config.Cfg{}, statickey.New())
		_, err := s.readPluginManifest(context.Background(), []byte(modified))
		require.Error(t, err)
	})
}

func TestReadPluginManifestV2(t *testing.T) {
	txt := `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "manifestVersion": "2.0.0",
  "signatureType": "private",
  "signedByOrg": "willbrowne",
  "signedByOrgName": "Will Browne",
  "rootUrls": [
    "http://localhost:3000/"
  ],
  "plugin": "test",
  "version": "1.0.0",
  "time": 1605807018050,
  "keyId": "7e4d0c6a708866e7",
  "files": {
    "plugin.json": "2bb467c0bfd6c454551419efe475b8bf8573734e73c7bab52b14842adb62886f"
  }
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wqIEARMKAAYFAl+2q6oACgkQfk0ManCIZudmzwIJAXWz58cd/91rTXszKPnE
xbVEvERCbjKTtPBQBNQyqEvV+Ig3MuBSNOVy2SOGrMsdbS6lONgvgt4Cm+iS
wV+vYifkAgkBJtg/9DMB7/iX5O0h49CtSltcpfBFXlGqIeOwRac/yENzRzAA
khdr/tZ1PDgRxMqB/u+Vtbpl0xSxgblnrDOYMSI=
=rLIE
-----END PGP SIGNATURE-----`

	t.Run("valid manifest", func(t *testing.T) {
		s := ProvideService(&config.Cfg{}, statickey.New())
		manifest, err := s.readPluginManifest(context.Background(), []byte(txt))

		require.NoError(t, err)
		require.NotNil(t, manifest)
		assert.Equal(t, "test", manifest.Plugin)
		assert.Equal(t, "1.0.0", manifest.Version)
		assert.Equal(t, int64(1605807018050), manifest.Time)
		assert.Equal(t, "7e4d0c6a708866e7", manifest.KeyID)
		assert.Equal(t, "2.0.0", manifest.ManifestVersion)
		assert.Equal(t, plugins.SignatureTypePrivate, manifest.SignatureType)
		assert.Equal(t, "willbrowne", manifest.SignedByOrg)
		assert.Equal(t, "Will Browne", manifest.SignedByOrgName)
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
					Status:     plugins.SignatureStatusValid,
					Type:       plugins.SignatureTypeGrafana,
					SigningOrg: "Grafana Labs",
				},
			},
			{
				appURL: "https://non.matching.url.com",
				expectedSignature: plugins.Signature{
					Status: plugins.SignatureStatusInvalid,
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
			s := ProvideService(&config.Cfg{}, statickey.New())
			sig, err := s.Calculate(context.Background(), &fakes.FakePluginSource{
				PluginClassFunc: func(ctx context.Context) plugins.Class {
					return plugins.ClassExternal
				},
			}, plugins.FoundPlugin{
				JSONData: plugins.JSONData{
					ID: "test-datasource",
					Info: plugins.Info{
						Version: "1.0.0",
					},
				},
				FS: mustNewStaticFSForTests(t, basePath),
			})
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
		s := ProvideService(&config.Cfg{}, statickey.New())
		sig, err := s.Calculate(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
		}, plugins.FoundPlugin{
			JSONData: plugins.JSONData{
				ID:   "test-renderer",
				Type: plugins.TypeRenderer,
				Info: plugins.Info{
					Version: "1.0.0",
				},
			},
			FS: mustNewStaticFSForTests(t, basePath),
		})
		require.NoError(t, err)
		require.Equal(t, plugins.Signature{
			Status:     plugins.SignatureStatusValid,
			Type:       plugins.SignatureTypeGrafana,
			SigningOrg: "Grafana Labs",
		}, sig)
	})

	t.Run("Signature verification should work with any path separator", func(t *testing.T) {
		const basePath = "../testdata/app-with-child/dist"

		platformWindows := fsPlatform{separator: '\\'}
		platformUnix := fsPlatform{separator: '/'}

		type testCase struct {
			name      string
			platform  fsPlatform
			fsFactory func() (plugins.FS, error)
		}
		var testCases []testCase
		for _, fsFactory := range []struct {
			name string
			f    func() (plugins.FS, error)
		}{
			{"local fs", func() (plugins.FS, error) {
				return plugins.NewLocalFS(basePath), nil
			}},
			{"static fs", func() (plugins.FS, error) {
				return plugins.NewStaticFS(plugins.NewLocalFS(basePath))
			}},
		} {
			testCases = append(testCases, []testCase{
				{"unix " + fsFactory.name, platformUnix, fsFactory.f},
				{"windows " + fsFactory.name, platformWindows, fsFactory.f},
			}...)
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				// Replace toSlash for cross-platform testing
				oldToSlash := toSlash
				oldFromSlash := fromSlash
				t.Cleanup(func() {
					toSlash = oldToSlash
					fromSlash = oldFromSlash
				})
				toSlash = tc.platform.toSlashFunc()
				fromSlash = tc.platform.fromSlashFunc()

				s := ProvideService(&config.Cfg{}, statickey.New())
				pfs, err := tc.fsFactory()
				require.NoError(t, err)
				pfs, err = newPathSeparatorOverrideFS(string(tc.platform.separator), pfs)
				require.NoError(t, err)
				sig, err := s.Calculate(context.Background(), &fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return plugins.ClassExternal
					},
				}, plugins.FoundPlugin{
					JSONData: plugins.JSONData{
						ID:   "myorgid-simple-app",
						Type: plugins.TypeApp,
						Info: plugins.Info{
							Version: "%VERSION%",
						},
					},
					FS: pfs,
				})
				require.NoError(t, err)
				require.Equal(t, plugins.Signature{
					Status:     plugins.SignatureStatusValid,
					Type:       plugins.SignatureTypeGrafana,
					SigningOrg: "Grafana Labs",
				}, sig)
			})
		}
	})
}

type fsPlatform struct {
	separator rune
}

// toSlashFunc returns a new function that acts as filepath.ToSlash but for the specified os-separator.
// This can be used to test filepath.ToSlash-dependant code cross-platform.
func (p fsPlatform) toSlashFunc() func(string) string {
	return func(path string) string {
		if p.separator == '/' {
			return path
		}
		return strings.ReplaceAll(path, string(p.separator), "/")
	}
}

// fromSlashFunc returns a new function that acts as filepath.FromSlash but for the specified os-separator.
// This can be used to test filepath.FromSlash-dependant code cross-platform.
func (p fsPlatform) fromSlashFunc() func(string) string {
	return func(path string) string {
		if p.separator == '/' {
			return path
		}
		return strings.ReplaceAll(path, "/", string(p.separator))
	}
}

func TestFsPlatform(t *testing.T) {
	t.Run("unix", func(t *testing.T) {
		toSlashUnix := fsPlatform{'/'}.toSlashFunc()
		require.Equal(t, "folder", toSlashUnix("folder"))
		require.Equal(t, "/folder", toSlashUnix("/folder"))
		require.Equal(t, "/folder/file", toSlashUnix("/folder/file"))
		require.Equal(t, "/folder/other\\file", toSlashUnix("/folder/other\\file"))
	})

	t.Run("windows", func(t *testing.T) {
		toSlashWindows := fsPlatform{'\\'}.toSlashFunc()
		require.Equal(t, "folder", toSlashWindows("folder"))
		require.Equal(t, "C:/folder", toSlashWindows("C:\\folder"))
		require.Equal(t, "folder/file.exe", toSlashWindows("folder\\file.exe"))
	})
}

// fsPathSeparatorFiles embeds a plugins.FS and overrides the Files() behaviour so all the returned elements
// have the specified path separator. This can be used to test Files() behaviour cross-platform.
type fsPathSeparatorFiles struct {
	plugins.FS

	separator string
}

// newPathSeparatorOverrideFS returns a new fsPathSeparatorFiles. Sep is the separator that will be used ONLY for
// the elements returned by Files().
func newPathSeparatorOverrideFS(sep string, ufs plugins.FS) (fsPathSeparatorFiles, error) {
	return fsPathSeparatorFiles{
		FS:        ufs,
		separator: sep,
	}, nil
}

// Files returns LocalFS.Files(), but all path separators for the current platform (filepath.Separator)
// are replaced with f.separator.
func (f fsPathSeparatorFiles) Files() ([]string, error) {
	files, err := f.FS.Files()
	if err != nil {
		return nil, err
	}
	const osSepStr = string(filepath.Separator)
	for i := 0; i < len(files); i++ {
		files[i] = strings.ReplaceAll(files[i], osSepStr, f.separator)
	}
	return files, nil
}

func (f fsPathSeparatorFiles) Open(name string) (fs.File, error) {
	return f.FS.Open(strings.ReplaceAll(name, f.separator, string(filepath.Separator)))
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
			pfs, err := newPathSeparatorOverrideFS(
				"/", plugins.NewInMemoryFS(
					map[string][]byte{"a": nil, strings.Join([]string{"a", "b", "c"}, tc.sep): nil},
				),
			)
			require.NoError(t, err)
			files, err := pfs.Files()
			require.NoError(t, err)
			exp := []string{"a", strings.Join([]string{"a", "b", "c"}, tc.sep)}
			sort.Strings(files)
			sort.Strings(exp)
			require.Equal(t, exp, files)
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
			got, err := urlMatch(tt.args.specs, tt.args.target, plugins.SignatureTypePrivateGlob)
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
			got, err := urlMatch(tt.args.specs, tt.args.target, plugins.SignatureTypePrivate)
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
			s := ProvideService(&config.Cfg{}, statickey.New())
			err := s.validateManifest(context.Background(), *tc.manifest, nil)
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
		SignatureType:   plugins.SignatureTypeGrafana,
		SignedByOrg:     "grafana",
		SignedByOrgName: "grafana",
	}

	for _, cb := range cbs {
		cb(m)
	}

	return m
}

func mustNewStaticFSForTests(t *testing.T, dir string) plugins.FS {
	sfs, err := plugins.NewStaticFS(plugins.NewLocalFS(dir))
	require.NoError(t, err)
	return sfs
}

type revokedKeyProvider struct{}

func (p *revokedKeyProvider) GetPublicKey(ctx context.Context, keyID string) (string, error) {
	// dummy revoked key created locally
	const publicKeyText = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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
pHo=
=RnzB
-----END PGP PUBLIC KEY BLOCK-----
`
	return publicKeyText, nil
}

func Test_VerifyRevokedKey(t *testing.T) {
	s := ProvideService(&config.Cfg{}, &revokedKeyProvider{})
	m := createV2Manifest(t)
	txt := `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "manifestVersion": "2.0.0",
  "signatureType": "private",
  "signedByOrg": "andresmartinez",
  "signedByOrgName": "andresmartinez",
  "rootUrls": [
    "https://example.com/grafana"
  ],
  "plugin": "myorg-withbackend-app",
  "version": "1.0.0",
  "time": 1684235356873,
  "keyId": "CE6E5BFAC57F4B66",
  "files": {
    "CHANGELOG.md": "ba613d6f914b27dce9ace4d8c0cb074273c9eb6c536d8e7ac24c5ce6ae941fd0",
    "gpx_app-myorg-withbackend-app_darwin_amd64": "d85169cc9c3cacf71f2b570478dc14d9db1985f97d0f6c93b9cccfe1cbb7a87b",
    "img/logo.svg": "1defc6f7e585c67657bcfd8fddc599ee7dfa82f8674413f49fa274c2cd453ec6",
    "plugin.json": "f74b561db5b079c610cc0025602cb489c8108b18db76f2190e690501f7f5b8c6",
    "go_plugin_build_manifest": "9a85c38b762566db00468a39335eab9bf14d8a86bdf5de774feae8f5c1936d8d",
    "standalone.txt": "da5961ac3dc4ffe6bd26c6b5633e37bef1815cf4beee2dea769188a1295e956c",
    "gpx_app-myorg-withbackend-app_linux_amd64": "4ed9ea3a13700dc36ce2918d07d6b3d2e04e2174966b8da219890f57192b36e6",
    "gpx_app-myorg-withbackend-app_linux_arm": "c9e6f2c8b3e0216d46299442ab1e32a9f4ece35b806e499bc027e8de51e13f64",
    "LICENSE": "c5accbbd8546e94c34aed24afe689a617627d18eed5a6c48277e48db57c23851",
    "README.md": "20268419628cb55aa86394d01012be936f70f1131cee6fcf4008aded5164b7f0",
    "gpx_app-myorg-withbackend-app_windows_amd64.exe": "4106704de494fc6a82733961b119c2393b066fc6f9a32822ab8f1dbacdabe057",
    "module.js.map": "9cdc252e92c0408fb39326af592720223640a1a7f1a68fea23ac3aea056bf938",
    "gpx_app-myorg-withbackend-app_darwin_arm64": "ae8f2966f1100a5f32af1a87f6edda0aacec615246043211926b071136909784",
    "gpx_app-myorg-withbackend-app_linux_arm64": "1ea731dbe23049e790cb51c09b18983a65819f5b3b52c2f8d787293c6f362887",
    "pid.txt": "edf0f8e95323881a533842f79e808584d4f584831ab53b1887c31e683e2fd5a5",
    "module.js": "061e1da2918204c34f38fcb717f1e27dacd64e5cdca64f281a7f4ebb2baf33c1"
  }
}
-----BEGIN PGP SIGNATURE-----

iQGzBAEBCgAdFiEEAucR15yFWlGOwy8FuJPlo2DZEaAFAmRkuWAACgkQuJPlo2DZ
EaAILgv/YElEpqelrqga3usjPsA9EAX4f7eOUv2mG9gg5UISpEc8KXwJ3htXd/3+
W2ij9KehkLsFsCTQs+oMIqJjsJAqA1nCwYEOIJlcDcuobMMMSqdJMG6xZOq3dTX4
O2DEcybtHHRD3C59ks1wmwNdI8B5T5SCxDXGmBo4kBh1h3t7sSlE3MoSTIfE3csR
GyB05ONtLpMwc+xlyuuSjcxcNAYcbCl8ts29sj3EsXSD/Vnh06Rhex2XmVtLqog9
4ygC0fBSpWONSPW31yckdae2L+ZncJVO5LZ2gdM/+69a+v5f/TTauaM7Ts3PYUBf
FtJEv/KHDaxR+SwxDgu7iMoiKntGaozyG1oZvlsSYnzs0Y9a6fHoxJT2zNCIotP2
NPprfbHTrYiDkTN3LBksKcYLU7VO8Z1/VriGfhbgDAP3s1zwSmx4tiXdwZLmdJbC
6jDpIJL3mDBMlVxNe/cCgYGIA90YpqQe/B0X3sJwUcUNSQrvZJpgoz8k04AuKuxh
syrhBXja
=cQxQ
-----END PGP SIGNATURE-----
`
	block, _ := clearsign.Decode([]byte(txt))
	require.NotNil(t, block, "failed to decode block")
	err := s.validateManifest(context.Background(), *m, block)
	require.Error(t, err)
	require.ErrorIs(t, err, openpgpErrors.ErrKeyRevoked)
}
