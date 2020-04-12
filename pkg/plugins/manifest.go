package plugins

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/clearsign"
)

// Soon we can fetch keys from:
//  https://grafana.com/api/plugins/ci/keys
var publicKeyText = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

xpMEXpOgkxMFK4EEACMEIwQBZ/JLPwfBWJjJYSOCbedH7z7fv6UxDIJGQoue
/qrAeGnbwH/jP7xbAutK34BktbKX1H5S1xhvBXQOlZI1sKJKJVABBXd8cK/g
adA7H0FqRteqrXiGzpFV4reDPoUWBUiw1uHVKK5TlW4Y6qrjtIIGMT+54Fyg
sWpO7M8UDajhy7ZnKlfNGUdyYWZhbmEgPGVuZ0BncmFmYW5hLmNvbT7CvAQQ
EwoAIAUCXpOgkwYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BAAoJEMS0I0zy
2S44L3ECCQFj2UMCW4T+QMuEjbJN17S1//8l5I0RJp/uU6v1v6h72ynVkX4w
2u6WNRllgVROzN9fgG1dZkI6/lM2mCUdDAEWagIJAcDYP6atNjYX6v8CZGWS
XbkLrD3mx1UljRGEYygnd16F588UUwgUI1B7UoVf9J+oDyCYkC1bOYGabHPf
QOX7zOsVzpcEXpOgkxIFK4EEACMEIwQBCepTf+FU34qXoHG7Ga/sQ313+Cds
10V+YEY4+34sHue9ooNwBSSC3WE0QpviTNN8tR6xWy7YhJWzlRys4KQOMYAA
gn6uQFp2kAvRxTYwI6eysomzuTq/keHn4U6aGeL8ORXnUaEBMmf6Zz1QI021
zyajs4cObofqJsfg3VzIJnm7OzgDAQoJwqQEGBMKAAkFAl6ToJMCGwwACgkQ
xLQjTPLZLjiYZwIJAfYyYpa9Q+pslbimzmcmSATHz4CV722tjXYkqr9Lkbox
ePDfXuudwoNnkhSucVcqUvbSt1O7ecwV0WAgLY0VVt+uAgiYfeTnmL/1GCrc
hbUL/NckkJ7fMp3ta7rmdBOOdE+0YSuSKxsM0GdHuUvO5CMfqWZq49GZaaBL
QHACY1s5Ay9s1A==
=FoHS
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

// readPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func readPluginManifest(body []byte) (*PluginManifest, error) {
	block, _ := clearsign.Decode(body)
	if block == nil {
		return nil, fmt.Errorf("unable to decode manifest")
	}

	txt := string(block.Plaintext)
	fmt.Printf("PLAINTEXT: %s", txt)

	// Convert to a well typed object
	manifest := &PluginManifest{}
	err := json.Unmarshal(block.Plaintext, &manifest)
	if err != nil {
		return nil, fmt.Errorf("Error parsing manifest JSON: %s", err)
	}

	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewBufferString(publicKeyText))
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %s", err)
	}

	if _, err := openpgp.CheckDetachedSignature(keyring,
		bytes.NewBuffer(block.Bytes),
		block.ArmoredSignature.Body); err != nil {
		return nil, fmt.Errorf("failed to check signature: %s", err)
	}

	return manifest, nil
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
		return PluginSignatureModified
	}

	// Verify the manifest contents
	for p, hash := range manifest.Files {
		// Open the file
		f, err := os.Open(path.Join(plugin.PluginDir, p))
		if err != nil {
			return PluginSignatureModified
		}
		defer f.Close()

		h := sha256.New()
		if _, err := io.Copy(h, f); err != nil {
			return PluginSignatureModified
		}
		sum := string(h.Sum(nil))
		if sum != hash {
			return PluginSignatureModified
		}
	}

	// Everything OK
	return PluginSignatureValid
}
