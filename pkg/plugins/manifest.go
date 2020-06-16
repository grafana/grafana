package plugins

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
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
}

// readPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func readPluginManifest(body []byte) (*pluginManifest, error) {
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

	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewBufferString(publicKeyText))
	if err != nil {
		return nil, errutil.Wrap("failed to parse public key", err)
	}

	if _, err := openpgp.CheckDetachedSignature(keyring,
		bytes.NewBuffer(block.Bytes),
		block.ArmoredSignature.Body); err != nil {
		return nil, errutil.Wrap("failed to check signature", err)
	}

	return manifest, nil
}

func getChksums(dpath, manifestPath string, log log.Logger) (map[string]string, error) {
	manifestPath = filepath.Clean(manifestPath)

	chksums := map[string]string{}
	if err := filepath.Walk(dpath, func(path string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if fi.IsDir() {
			return nil
		}

		path = filepath.Clean(path)

		// Handle symbolic links
		if fi.Mode()&os.ModeSymlink == os.ModeSymlink {
			finalPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}

			log.Debug("Handling symlink", "source", path, "target", finalPath)

			info, err := os.Stat(finalPath)
			if err != nil {
				return err
			}
			if info.IsDir() {
				return nil
			}

			if _, err := filepath.Rel(dpath, finalPath); err != nil {
				return fmt.Errorf("symbolic link %q targets a file outside of the plugin directory: %q", path, finalPath)
			}

			if finalPath == manifestPath {
				return nil
			}

			fi = info
		}

		if path == manifestPath {
			return nil
		}

		// Ignore images
		for _, sfx := range []string{"png", "gif", "svg"} {
			if strings.HasSuffix(fi.Name(), fmt.Sprintf(".%s", sfx)) {
				return nil
			}
		}

		h := sha256.New()
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		if _, err := io.Copy(h, f); err != nil {
			return err
		}

		relPath, err := filepath.Rel(dpath, path)
		if err != nil {
			return err
		}
		chksums[relPath] = fmt.Sprintf("%x", h.Sum(nil))

		return nil
	}); err != nil {
		return nil, err
	}

	return chksums, nil
}

// getPluginSignatureState returns the signature state for a plugin.
func getPluginSignatureState(log log.Logger, plugin *PluginBase) (PluginSignature, error) {
	log.Debug("Getting signature state of plugin", "plugin", plugin.Id)
	manifestPath := path.Join(plugin.PluginDir, "MANIFEST.txt")

	byteValue, err := ioutil.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		return PluginSignatureUnsigned, nil
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		return PluginSignatureInvalid, nil
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.Id || manifest.Version != plugin.Info.Version {
		return PluginSignatureModified, nil
	}

	chksums, err := getChksums(plugin.PluginDir, manifestPath, log)
	if err != nil {
		return PluginSignatureInvalid, err
	}
	if len(chksums) != len(manifest.Files) {
		log.Warn("Plugin's files differ from manifest", "plugin", plugin.Id)
		return PluginSignatureModified, nil
	}

	// Verify the manifest contents
	log.Debug("Verifying contents of plugin manifest", "plugin", plugin.Id)
	for p, hash := range manifest.Files {
		fp := path.Join(plugin.PluginDir, p)

		gotHash, ok := chksums[p]
		if !ok {
			log.Warn("Plugin file from manifest is missing", "plugin", plugin.Id, "filename", fp)
		}
		if gotHash != hash {
			log.Warn("Plugin file's signature has been modified versus manifest", "plugin", plugin.Id, "filename", fp)
			return PluginSignatureModified, nil
		}
	}

	log.Debug("Plugin's signature is valid", "plugin", plugin.Id)

	// Everything OK
	return PluginSignatureValid, nil
}
