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

xjMEXpDb3BYJKwYBBAHaRw8BAQdAshYq1Z7bl9dg3uKqCqky1eiXNg+p0TZ+
8CINKoLdSXvNGUdyYWZhbmEgPGVuZ0BncmFmYW5hLmNvbT7CeAQQFgoAIAUC
XpDb3AYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BAAoJEIfd+UIbIeMRUTkB
APd39n6n14HNO0LkQcd7hSZlw7LJY61s07s1gTjnsH90AQCUN9cUpqCESIq1
0m0ADZ/Ogc37nrtTgotpwX14ciSACc44BF6Q29wSCisGAQQBl1UBBQEBB0Bn
VsrtQl2Dq21y7S64Y6ODmP2mCM7V2kLzblzRH2SkIQMBCAfCYQQYFggACQUC
XpDb3AIbDAAKCRCH3flCGyHjEbTVAP9lV6vhCauoycIjwQGmOJRoSe/hg8y/
H28G9O6n1prDfgD+PuSfm4QoOI8waUYlmHLuZbvRergzTWOShff/V8hy7wo=
=yXhq
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

	keyring, err := openpgp.keys.ReadArmoredKeyRing(bytes.NewBufferString(publicKeyText))
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
