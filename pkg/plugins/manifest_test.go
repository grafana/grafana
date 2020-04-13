package plugins

import (
	"strings"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestManifestParsing(t *testing.T) {

	Convey("Should validate manifest", t, func() {
		txt := `
-----BEGIN PGP SIGNED MESSAGE-----
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
    "plugin.json": "85ed629483924072345b912608fdd99d7e73da49"
  },
  "time": 1586614713905,
  "keyId": "87ddf9421b21e311"
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wqEEARMKAAYFAl6ToJQACgkQxLQjTPLZLjis/QIHXN4XgIqlTYklPu+mSPVF
BgGI81jh9n4K7crg01naHalpAzI9bbi6PGJrxlsD0KEVynOOfUk0OISDMGYw
OcWeFasCCQEzPG5WdQumWTZtV2i8jax4aLhii3jGCaReg+/hF/xlnZZ6yRP6
PSjgC2n1m40AVLZ0+GCRLspAYTEFrlpWWzqSrQ==
=oAbf
-----END PGP SIGNATURE-----
`

		manifest, err := readPluginManifest([]byte(txt))

		So(err, ShouldBeNil)
		So(manifest, ShouldNotBeNil)
		So(manifest.Plugin, ShouldEqual, "grafana-googlesheets-datasource")

		// Modified text should fail
		modified := strings.ReplaceAll(txt, "README.md", "xxxxxxxxxx")
		manifest, err = readPluginManifest([]byte(modified))
		So(err, ShouldNotBeNil)
		So(manifest, ShouldBeNil)
	})
}
