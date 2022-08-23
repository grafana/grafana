package signature

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gobwas/glob"

	// TODO: replace deprecated `golang.org/x/crypto` package https://github.com/grafana/grafana/issues/46050
	// nolint:staticcheck
	"golang.org/x/crypto/openpgp"
	// nolint:staticcheck
	"golang.org/x/crypto/openpgp/clearsign"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

// Soon we can fetch keys from:
//
//	https://grafana.com/api/plugins/ci/keys
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
	ManifestVersion string                `json:"manifestVersion"`
	SignatureType   plugins.SignatureType `json:"signatureType"`
	SignedByOrg     string                `json:"signedByOrg"`
	SignedByOrgName string                `json:"signedByOrgName"`
	RootURLs        []string              `json:"rootUrls"`
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
	var manifest pluginManifest
	err := json.Unmarshal(block.Plaintext, &manifest)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Error parsing manifest JSON", err)
	}

	if err = validateManifest(manifest, block); err != nil {
		return nil, err
	}

	return &manifest, nil
}

func Calculate(mlog log.Logger, plugin *plugins.Plugin) (plugins.Signature, error) {
	if plugin.IsCorePlugin() {
		return plugins.Signature{
			Status: plugins.SignatureInternal,
		}, nil
	}

	pluginFiles, err := pluginFilesRequiringVerification(plugin)
	if err != nil {
		mlog.Warn("Could not collect plugin file information in directory", "pluginID", plugin.ID, "dir", plugin.PluginDir)
		return plugins.Signature{
			Status: plugins.SignatureInvalid,
		}, err
	}

	manifestPath := filepath.Join(plugin.PluginDir, "MANIFEST.txt")

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `manifestPath` is based
	// on plugin the folder structure on disk and not user input.
	byteValue, err := os.ReadFile(manifestPath)
	if err != nil || len(byteValue) < 10 {
		mlog.Debug("Plugin is unsigned", "id", plugin.ID)
		return plugins.Signature{
			Status: plugins.SignatureUnsigned,
		}, nil
	}

	manifest, err := readPluginManifest(byteValue)
	if err != nil {
		mlog.Debug("Plugin signature invalid", "id", plugin.ID, "err", err)
		return plugins.Signature{
			Status: plugins.SignatureInvalid,
		}, nil
	}

	// Make sure the versions all match
	if manifest.Plugin != plugin.ID || manifest.Version != plugin.Info.Version {
		return plugins.Signature{
			Status: plugins.SignatureModified,
		}, nil
	}

	// Validate that plugin is running within defined root URLs
	if len(manifest.RootURLs) > 0 {
		if match, err := urlMatch(manifest.RootURLs, setting.AppUrl, manifest.SignatureType); err != nil {
			mlog.Warn("Could not verify if root URLs match", "plugin", plugin.ID, "rootUrls", manifest.RootURLs)
			return plugins.Signature{}, err
		} else if !match {
			mlog.Warn("Could not find root URL that matches running application URL", "plugin", plugin.ID,
				"appUrl", setting.AppUrl, "rootUrls", manifest.RootURLs)
			return plugins.Signature{
				Status: plugins.SignatureInvalid,
			}, nil
		}
	}

	manifestFiles := make(map[string]struct{}, len(manifest.Files))

	// Verify the manifest contents
	for p, hash := range manifest.Files {
		err = verifyHash(mlog, plugin.ID, filepath.Join(plugin.PluginDir, p), hash)
		if err != nil {
			return plugins.Signature{
				Status: plugins.SignatureModified,
			}, nil
		}

		manifestFiles[p] = struct{}{}
	}

	if manifest.isV2() {
		// Track files missing from the manifest
		var unsignedFiles []string
		for _, f := range pluginFiles {
			if _, exists := manifestFiles[f]; !exists {
				unsignedFiles = append(unsignedFiles, f)
			}
		}

		if len(unsignedFiles) > 0 {
			mlog.Warn("The following files were not included in the signature", "plugin", plugin.ID, "files", unsignedFiles)
			return plugins.Signature{
				Status: plugins.SignatureModified,
			}, nil
		}
	}

	mlog.Debug("Plugin signature valid", "id", plugin.ID)
	return plugins.Signature{
		Status:     plugins.SignatureValid,
		Type:       manifest.SignatureType,
		SigningOrg: manifest.SignedByOrgName,
	}, nil
}

func verifyHash(mlog log.Logger, pluginID string, path string, hash string) error {
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `path` is based
	// on the path provided in a manifest file for a plugin and not user input.
	f, err := os.Open(path)
	if err != nil {
		mlog.Warn("Plugin file listed in the manifest was not found", "plugin", pluginID, "path", path)
		return fmt.Errorf("plugin file listed in the manifest was not found")
	}
	defer func() {
		if err := f.Close(); err != nil {
			mlog.Warn("Failed to close plugin file", "path", path, "err", err)
		}
	}()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("could not calculate plugin file checksum")
	}
	sum := hex.EncodeToString(h.Sum(nil))
	if sum != hash {
		mlog.Warn("Plugin file checksum does not match signature checksum", "plugin", pluginID, "path", path)
		return fmt.Errorf("plugin file checksum does not match signature checksum")
	}

	return nil
}

// pluginFilesRequiringVerification gets plugin filenames that require verification for plugin signing
// returns filenames as a slice of posix style paths relative to plugin directory
func pluginFilesRequiringVerification(plugin *plugins.Plugin) ([]string, error) {
	var files []string
	err := filepath.Walk(plugin.PluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.Mode()&os.ModeSymlink == os.ModeSymlink {
			symlinkPath, err := filepath.EvalSymlinks(path)
			if err != nil {
				return err
			}

			symlink, err := os.Stat(symlinkPath)
			if err != nil {
				return err
			}

			// verify that symlinked file is within plugin directory
			p, err := filepath.Rel(plugin.PluginDir, symlinkPath)
			if err != nil {
				return err
			}
			if p == ".." || strings.HasPrefix(p, ".."+string(filepath.Separator)) {
				return fmt.Errorf("file '%s' not inside of plugin directory", p)
			}

			// skip adding symlinked directories
			if symlink.IsDir() {
				return nil
			}
		}

		// skip directories and MANIFEST.txt
		if info.IsDir() || info.Name() == "MANIFEST.txt" {
			return nil
		}

		// verify that file is within plugin directory
		file, err := filepath.Rel(plugin.PluginDir, path)
		if err != nil {
			return err
		}
		if strings.HasPrefix(file, ".."+string(filepath.Separator)) {
			return fmt.Errorf("file '%s' not inside of plugin directory", file)
		}

		files = append(files, filepath.ToSlash(file))

		return nil
	})

	return files, err
}

func urlMatch(specs []string, target string, signatureType plugins.SignatureType) (bool, error) {
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

		if signatureType != plugins.PrivateGlobSignature {
			continue
		}

		sp, err := glob.Compile(spec, '/', '.')
		if err != nil {
			return false, err
		}
		if match := sp.Match(target); match {
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
