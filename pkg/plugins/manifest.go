package plugins

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"io/ioutil"
	"os"
	"path"
	"sync"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/errutil"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/clearsign"
)

// pluginManifest holds details for the file manifest
type pluginManifest struct {
	Plugin  string            `json:"plugin"`
	Version string            `json:"version"`
	KeyID   string            `json:"keyId"`
	Time    int64             `json:"time"`
	Files   map[string]string `json:"files"`
}

// ManifestKeys is the database representation of public keys
// used to verify plugin manifests.
type ManifestKeys struct {
	ID        int64  `xorm:"id autoincr"`
	KeyID     string `xorm:"key_id"`
	PublicKey string
	Since     int64
	RevokedAt int64
	UpdatedAt int64
}

type manifestKeysJSON struct {
	KeyID     string `json:"keyId"`
	Since     int64  `json:"since"`
	RevokedAt int64  `json:"revoked_at"`
	PublicKey string `json:"public"`
}

type manifestVerifier struct {
	sqlstore   *sqlstore.SqlStore
	lock       sync.Mutex
	publicKeys map[string]ManifestKeys
}

func newManifestVerifier(sqlstore *sqlstore.SqlStore) *manifestVerifier {
	return &manifestVerifier{sqlstore: sqlstore}
}

// getPublicKey loads public keys from the database.
// Soon we can updated keys from https://grafana.com/api/plugins/ci/keys
func (pmv *manifestVerifier) getPublicKey(keyID string) (string, error) {
	pmv.lock.Lock()
	defer pmv.lock.Unlock()

	// since we don't have any public keys we need to load them first
	if len(pmv.publicKeys) == 0 {
		session := pmv.sqlstore.NewSession()
		defer session.Close()

		var keys []ManifestKeys
		err := session.Find(&keys)
		if err != nil {
			return "", err
		}

		pmv.publicKeys = make(map[string]ManifestKeys, len(keys))
		for _, k := range keys {
			pmv.publicKeys[k.KeyID] = k
		}
	}

	key, exist := pmv.publicKeys[keyID]
	if exist {
		return key.PublicKey, nil
	}

	return "", errors.New("Could not find public Key")
}

// readPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func (pmv *manifestVerifier) readPluginManifest(body []byte) (*pluginManifest, error) {
	block, _ := clearsign.Decode(body)
	if block == nil {
		return nil, errors.New("unable to decode manifest")
	}

	// Convert to a well typed object
	manifest := &pluginManifest{}
	err := json.Unmarshal(block.Plaintext, &manifest)
	if err != nil {
		return nil, errutil.Wrap("Error parsing manifest JSON", err)
	}

	publicKeyText, err := pmv.getPublicKey(manifest.KeyID)
	if err != nil {
		return nil, err
	}

	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewBufferString(publicKeyText))
	if err != nil {
		return nil, errutil.Wrap("failed to parse public key", err)
	}

	_, err = openpgp.CheckDetachedSignature(keyring, bytes.NewBuffer(block.Bytes), block.ArmoredSignature.Body)
	if err != nil {
		return nil, errutil.Wrap("failed to check signature", err)
	}

	return manifest, nil
}

// GetPluginSignatureState returns the signature state for a plugin
func (pmv *manifestVerifier) verifyPluginSignature(plugin *PluginBase) PluginSignature {
	manifestPath := path.Join(plugin.PluginDir, "MANIFEST.txt")

	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		return PluginSignatureUnsigned
	}

	manifest, err := pmv.readPluginManifest(byteValue)
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
