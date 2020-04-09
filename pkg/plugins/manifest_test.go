package plugins

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestManifestParsing(t *testing.T) {

	Convey("Should validate manifest", t, func() {
		txt := `
-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

{
  "files": {
    "LICENSE": "7df059597099bb7dcf25d2a9aedfaf4465f72d8d",
    "README.md": "4ebed28a02dc029719296aa847bffcea8eb5b9ff",
    "gfx_sheets_darwin_amd64": "4493f107eb175b085f020c1afea04614232dc0fd",
    "gfx_sheets_linux_amd64": "d8b05884e3829d1389a9c0e4b79b0aba8c19ca4a",
    "gfx_sheets_windows_amd64.exe": "88f33db20182e17c72c2823fe3bed87d8c45b0fd",
    "img/config-page.png": "e6d8f6704dbe85d5f032d4e8ba44ebc5d4a68c43",
    "img/dashboard.png": "63d79d0e0f9db21ea168324bd4e180d6892b9d2b",
    "img/graph.png": "7ea6295954b24be55b27320af2074852fb088fa1",
    "img/query-editor.png": "262f2bfddb004c7ce567042e8096f9e033c9b1bd",
    "img/sheets.svg": "f134ab85caff88b59ea903c5491c6a08c221622f",
    "module.js": "40b8c38cea260caed3cdc01d6e3c1eca483ab5c1",
    "plugin.json": "bfcae42976f0feca58eed3636655bce51702d3ed"
  },
  "plugin": "grafana-googlesheets-datasource",
  "version": "1.2.3",
  "keyId": "ABC",
  "time": 1586404562862
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wl4EARYKAAYFAl6OnNMACgkQ1uNw7xqtn45r0QEAqmoB/Q5NsJZNxnM69m2A
eQhcWNyo7yxO/4NZhVvBiJkA/iXUtptWbba3aw9TSZLn95LaUjKf4YUov29r
qX6kODEP
=YjQO
-----END PGP SIGNATURE-----
`

		manifest, err := readPluginManifest([]byte(txt))

		// For now OK
		So(err, ShouldBeNil)
		So(manifest, ShouldNotBeNil)
	})
}
