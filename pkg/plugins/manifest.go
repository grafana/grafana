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

// Soon we can fetch keys from:
//  https://grafana.com/api/plugins/ci/keys
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
	fmt.Printf("TODO... use publicKey: %s", publicKeyText)

	return nil, fmt.Errorf("todo... actually parse manifest")

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
	manifestPath := path.Join(plugin.PluginDir, "MANIFEST.txt")

	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		return PluginSignatureUnsigned
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		return PluginSignatureInvalid
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.Id || manifest.Version != plugin.Info.Version {
		return PluginSignatureInvalid
	}

	// Verify the manifest contents
	for p, hash := range manifest.Files {
		// Open the file
		f, err := os.Open(path.Join(plugin.PluginDir, p))
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
		sum := (string)(h.Sum(nil))
		if sum != hash {
			log.Info("plugin mismatch: %s / %s", plugin.Id, p)
			return PluginSignatureModified
		}
	}

	// Everything OK
	return PluginSignatureValid
}
