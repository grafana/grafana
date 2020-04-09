package plugins

import (
	"crypto/sha256"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"

	"github.com/grafana/grafana/pkg/infra/log"
)

var publicKeyText = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

xjMEXo5V+RYJKwYBBAHaRw8BAQdAxIzDC0767A5eOHESiU8ACz5c9BWIrkbJ
/5a4m/zsFWnNG0pvbiBTbWl0aCA8am9uQGV4YW1wbGUuY29tPsJ4BBAWCgAg
BQJejlX5BgsJBwgDAgQVCAoCBBYCAQACGQECGwMCHgEACgkQ1uNw7xqtn452
hQD+LK/+1k5vdVVQDxRDyjN3+6Wiy/jK2wwH1JtHdnTUKKsA/iot3glN57wb
gaIQgQSZaE5E9tsIhGYhhNi8R743Oh4GzjgEXo5V+RIKKwYBBAGXVQEFAQEH
QCmdY+K50okUPp1NCFJxdje+Icr859fTwwRy9+hq+vUIAwEIB8JhBBgWCAAJ
BQJejlX5AhsMAAoJENbjcO8arZ+OpMwBAIcGCY1jMPo64h9G4MmFyPjL+wxn
U2YVAvfHQZnN+gD3AP47klt0/0tmSlbNwEvimZxA3tpUfNrtUO1K4E8VxSIn
Dg==
=PA1c
-----END PGP PUBLIC KEY BLOCK-----
`

/**
NOT REAL YET

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
	"plugin.json": "bfcae42976f0feca58eed3636655bce51702d3ed",
},
"plugin": "grafana-googlesheets-datasource",
"version": "1.2.3",
"keyId": "ABC",
"time": 123456
}
-----BEGIN PGP SIGNATURE-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

wl4EARYKAAYFAl6OYU8ACgkQ1uNw7xqtn46lNQD+IojxLTmT7yCaVsREzNuV
DOlTO2nLfa3K8zYt1vSaghsA/R7TViBrnjgt3dg3iu8GolZUy9IZeFttKm/z
Ld5KOdYB
=4GVX
-----END PGP SIGNATURE-----


**/

// PluginManifest holds details for the file manifest
type PluginManifest struct {
	Plugin  string            `json:"plugin"`
	Version string            `json:"version"`
	KeyID   string            `json:"keyId"`
	Time    int64             `json:"time"`
	Files   map[string]string `json:"files"`
}

// ReadPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func readPluginManifest(bytes []byte) (*PluginManifest, error) {
	return nil, fmt.Errorf("actually parse manifest!!!")

	// publicKey, err := crypto.NewKeyFromArmored(__publicKeyText)
	// if err != nil {
	// 	return nil, err
	// }

	// // Find the plaintext
	// verifiedPlainText, err := helper.VerifyCleartextMessageArmored(
	// 	publicKey,
	// 	(string)(bytes),
	// 	crypto.GetUnixTime())
	// if err != nil {
	// 	return nil, err
	// }

	// // Convert to a well typed object
	// manifest := &PluginManifest{}
	// err = json.Unmarshal([]byte(verifiedPlainText), &manifest)
	// if err == nil {
	// 	return nil, fmt.Errorf("Error parsing manifest JSON: %s", err)
	// }
	// return manifest, nil
}

// GetPluginSignatureState returns the signature state for a plugin
func GetPluginSignatureState(plugin *PluginBase) PluginSignature {
	manifestPath := path.Join(p.PluginDir, "MANIFEST.txt")
	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != null || len(byteValue) < 10 {
		return PluginSignatureUnsigned
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		return PluginSignatureInvalid
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.Id || manifest.Version != plugin.Version {
		return PluginSignatureInvalid
	}

	// Verify the manifest contents
	for p, hash := range manifest.Files {
		// Open the file
		f, err := os.Open(path.Join(p.PluginDir, p))
		if err != nil {
			log.Info("error opening plugin path: %s / %s", plugin.Id, p)
			return PluginSignatureModified
		}
		defer f.Close()

		h := sha256.New()
		if _, err := io.Copy(h, f); err != nil {
			log.Info("error reading body: %s / %s", plugin.Id, p)
			return PluginSignatureModified
		}
		sum := hash.Sum(nil)
		if sum != hash {
			log.Info("plugin mismatch: %s / %s", plugin.Id, p)
			return PluginSignatureModified
		}
	}

	// Everything OK
	return PluginSignatureValid
}
