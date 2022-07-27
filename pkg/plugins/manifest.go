package plugins

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/clearsign"
)

// Soon we can fetch keys from:
//  https://grafana.com/api/plugins/ci/keys
const publicKeyText = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.1
Comment: https://openpgpjs.org

xpMEXpTXXxMFK4EEACMEIwQBiOUQhvGbDLvndE0fEXaR0908wXzPGFpf0P0Z
HJ06tsq+0higIYHp7WTNJVEZtcwoYLcPRGaa9OQqbUU63BEyZdgAkPTz3RFd
5+TkDWZizDcaVFhzbDd500yTwexrpIrdInwC/jrgs7Zy/15h8KA59XXUkdmT
YB6TR+OA9RKME+dCJozNGUdyYWZhbmEgPGVuZ0BncmFmYW5hLmNvbT7CvAQQ
EwoAIAUCXpTXXwYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BAAoJEH5NDGpw
iGbnaWoCCQGQ3SQnCkRWrG6XrMkXOKfDTX2ow9fuoErN46BeKmLM4f1EkDZQ
Tpq3SE8+My8B5BIH3SOcBeKzi3S57JHGBdFA+wIJAYWMrJNIvw8GeXne+oUo
NzzACdvfqXAZEp/HFMQhCKfEoWGJE8d2YmwY2+3GufVRTI5lQnZOHLE8L/Vc
1S5MXESjzpcEXpTXXxIFK4EEACMEIwQBtHX/SD5Qm3v4V92qpaIZQgtTX0sT
cFPjYWAHqsQ1iENrYN/vg1wU3ADlYATvydOQYvkTyT/tbDvx2Fse8PL84MQA
YKKQ6AJ3gLVvmeouZdU03YoV4MYaT8KbnJUkZQZkqdz2riOlySNI9CG3oYmv
omjUAtzgAgnCcurfGLZkkMxlmY8DAQoJwqQEGBMKAAkFAl6U118CGwwACgkQ
fk0ManCIZuc0jAIJAVw2xdLr4ZQqPUhubrUyFcqlWoW8dQoQagwO8s8ubmby
KuLA9FWJkfuuRQr+O9gHkDVCez3aism7zmJBqIOi38aNAgjJ3bo6leSS2jR/
x5NqiKVi83tiXDPncDQYPymOnMhW0l7CVA7wj75HrFvvlRI/4MArlbsZ2tBn
N1c5v9v/4h6qeA==
=DNbR
-----END PGP PUBLIC KEY BLOCK-----
`

// pluginManifest holds details for the file manifest
type pluginManifest struct {
	Plugin  string            `json:"plugin"`
	Version string            `json:"version"`
	KeyID   string            `json:"keyId"`
	Time    int64             `json:"time"`
	Files   map[string]string `json:"files"`

	// V2 supported fields
	ManifestVersion string              `json:"manifestVersion"`
	SignatureType   PluginSignatureType `json:"signatureType"`
	SignedByOrg     string              `json:"signedByOrg"`
	SignedByOrgName string              `json:"signedByOrgName"`
	RootURLs        []string            `json:"rootUrls"`
}

func (m *pluginManifest) isV2() bool {
	return strings.HasPrefix(m.ManifestVersion, "2.")
}

// readPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func readPluginManifest(body []byte) (*pluginManifest, error) {
	block, _ := clearsign.Decode(body)
	if block == nil {
		return nil, errors.New("unable to decode manifest")
	}

	// Convert to a well typed object
	manifest := pluginManifest{}
	err := json.Unmarshal(block.Plaintext, &manifest)
	if err != nil {
		return nil, errutil.Wrap("Error parsing manifest JSON", err)
	}

	if err = validateManifest(manifest, block); err != nil {
		return nil, err
	}

	return &manifest, nil
}

// getPluginSignatureState returns the signature state for a plugin.
func getPluginSignatureState(log log.Logger, plugin *PluginBase) (PluginSignatureState, error) {
	log.Debug("Getting signature state of plugin", "plugin", plugin.Id, "isBackend", plugin.Backend)
	manifestPath := filepath.Join(plugin.PluginDir, "MANIFEST.txt")

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `manifestPath` is based
	// on plugin the folder structure on disk and not user input.
	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		log.Debug("Plugin is unsigned", "id", plugin.Id)
		return PluginSignatureState{
			Status: pluginSignatureUnsigned,
		}, nil
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		log.Debug("Plugin signature invalid", "id", plugin.Id)
		return PluginSignatureState{
			Status: pluginSignatureInvalid,
		}, nil
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.Id || manifest.Version != plugin.Info.Version {
		return PluginSignatureState{
			Status: pluginSignatureModified,
		}, nil
	}

	// Validate that plugin is running within defined root URLs
	if len(manifest.RootURLs) > 0 {
		if match, err := urlMatch(manifest.RootURLs, setting.AppUrl); err != nil {
			log.Warn("Could not verify if root URLs match", "plugin", plugin.Id, "rootUrls", manifest.RootURLs)
			return PluginSignatureState{}, err
		} else if !match {
			log.Warn("Could not find root URL that matches running application URL", "plugin", plugin.Id,
				"appUrl", setting.AppUrl, "rootUrls", manifest.RootURLs)
			return PluginSignatureState{
				Status: pluginSignatureInvalid,
			}, nil
		}
	}

	manifestFiles := make(map[string]bool, len(manifest.Files))

	// Verify the manifest contents
	log.Debug("Verifying contents of plugin manifest", "plugin", plugin.Id)
	for p, hash := range manifest.Files {
		// Open the file
		fp := filepath.Join(plugin.PluginDir, p)

		// nolint:gosec
		// We can ignore the gosec G304 warning on this one because `fp` is based
		// on the manifest file for a plugin and not user input.
		f, err := os.Open(fp)
		if err != nil {
			log.Warn("Plugin file listed in the manifest was not found", "plugin", plugin.Id, "filename", p, "dir", plugin.PluginDir)
			return PluginSignatureState{
				Status: pluginSignatureModified,
			}, nil
		}
		defer func() {
			if err := f.Close(); err != nil {
				log.Warn("Failed to close plugin file", "path", fp, "err", err)
			}
		}()

		h := sha256.New()
		if _, err := io.Copy(h, f); err != nil {
			log.Warn("Couldn't read plugin file", "plugin", plugin.Id, "filename", fp)
			return PluginSignatureState{
				Status: pluginSignatureModified,
			}, nil
		}
		sum := hex.EncodeToString(h.Sum(nil))
		if sum != hash {
			log.Warn("Plugin file's signature has been modified versus manifest", "plugin", plugin.Id, "filename", fp)
			return PluginSignatureState{
				Status: pluginSignatureModified,
			}, nil
		}
		manifestFiles[p] = true
	}

	if manifest.isV2() {
		// Track files missing from the manifest
		var unsignedFiles []string
		for _, f := range plugin.Files {
			if _, exists := manifestFiles[f]; !exists {
				unsignedFiles = append(unsignedFiles, f)
			}
		}

		if len(unsignedFiles) > 0 {
			log.Warn("The following files were not included in the signature", "plugin", plugin.Id, "files", unsignedFiles)
			return PluginSignatureState{
				Status: pluginSignatureModified,
			}, nil
		}
	}

	// Everything OK
	log.Debug("Plugin signature valid", "id", plugin.Id)
	return PluginSignatureState{
		Status:     pluginSignatureValid,
		Type:       manifest.SignatureType,
		SigningOrg: manifest.SignedByOrgName,
	}, nil
}

func urlMatch(specs []string, target string) (bool, error) {
	targetURL, err := url.Parse(target)
	if err != nil {
		return false, err
	}

	for _, spec := range specs {
		specURL, err := url.Parse(spec)
		if err != nil {
			return false, err
		}

		if specURL.Scheme == targetURL.Scheme && specURL.Host == targetURL.Host &&
			path.Clean(specURL.RequestURI()) == path.Clean(targetURL.RequestURI()) {
			return true, nil
		}
	}
	return false, nil
}

type invalidFieldErr struct {
	field string
}

func (r invalidFieldErr) Error() string {
	return fmt.Sprintf("valid manifest field %s is required", r.field)
}

func validateManifest(m pluginManifest, block *clearsign.Block) error {
	if len(m.Plugin) == 0 {
		return invalidFieldErr{field: "plugin"}
	}
	if len(m.Version) == 0 {
		return invalidFieldErr{field: "version"}
	}
	if len(m.KeyID) == 0 {
		return invalidFieldErr{field: "keyId"}
	}
	if m.Time == 0 {
		return invalidFieldErr{field: "time"}
	}
	if len(m.Files) == 0 {
		return invalidFieldErr{field: "files"}
	}
	if m.isV2() {
		if len(m.SignedByOrg) == 0 {
			return invalidFieldErr{field: "signedByOrg"}
		}
		if len(m.SignedByOrgName) == 0 {
			return invalidFieldErr{field: "signedByOrgName"}
		}
		if !m.SignatureType.IsValid() {
			return fmt.Errorf("%s is not a valid signature type", m.SignatureType)
		}
	}
	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewBufferString(publicKeyText))
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to parse public key", err)
	}

	if _, err = openpgp.CheckDetachedSignature(keyring,
		bytes.NewBuffer(block.Bytes),
		block.ArmoredSignature.Body); err != nil {
		return fmt.Errorf("%v: %w", "failed to check signature", err)
	}

	return nil
}
