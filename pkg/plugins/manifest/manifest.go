package manifest

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
	"strings"

	"github.com/gobwas/glob"

	// TODO: replace deprecated `golang.org/x/crypto` package https://github.com/grafana/grafana/issues/46050
	// nolint:staticcheck
	"golang.org/x/crypto/openpgp"
	// nolint:staticcheck
	"golang.org/x/crypto/openpgp/clearsign"

	"github.com/grafana/grafana/pkg/infra/log"
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

// PluginManifest holds details for the file manifest
type PluginManifest struct {
	Plugin  string            `json:"plugin"`
	Version string            `json:"version"`
	KeyID   string            `json:"keyId"`
	Time    int64             `json:"time"`
	Files   map[string]string `json:"files"`

	// V2 supported fields
	ManifestVersion string        `json:"manifestVersion"`
	SignatureType   SignatureType `json:"signatureType"`
	SignedByOrg     string        `json:"signedByOrg"`
	SignedByOrgName string        `json:"signedByOrgName"`
	RootURLs        []string      `json:"rootUrls"`
}

type SignatureType string

const (
	GrafanaSignatureType     SignatureType = "grafana"
	CommercialSignatureType  SignatureType = "commercial"
	CommunitySignatureType   SignatureType = "community"
	PrivateSignatureType     SignatureType = "private"
	PrivateGlobSignatureType SignatureType = "private-glob"
)

func (s SignatureType) IsValid() bool {
	switch s {
	case GrafanaSignatureType, CommercialSignatureType, CommunitySignatureType, PrivateSignatureType, PrivateGlobSignatureType:
		return true
	}
	return false
}

func (m *PluginManifest) IsV2() bool {
	return strings.HasPrefix(m.ManifestVersion, "2.")
}

// ReadPluginManifest attempts to read and verify the plugin manifest
// if any error occurs or the manifest is not valid, this will return an error
func ReadPluginManifest(body []byte) (*PluginManifest, error) {
	block, _ := clearsign.Decode(body)
	if block == nil {
		return nil, errors.New("unable to decode manifest")
	}

	// Convert to a well typed object
	var manifest PluginManifest
	err := json.Unmarshal(block.Plaintext, &manifest)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Error parsing manifest JSON", err)
	}

	if err = validateManifest(manifest, block); err != nil {
		return nil, err
	}

	return &manifest, nil
}

func VerifyHash(mlog log.Logger, path string, hash string) error {
	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `path` is based
	// on the path provided in a manifest file for a plugin and not user input.
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("plugin file %s is not listed in the manifest", path)
	}
	defer func() {
		if err = f.Close(); err != nil {
			mlog.Warn("Failed to close plugin file", "path", path, "err", err)
		}
	}()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return fmt.Errorf("could not calculate plugin file checksum")
	}
	sum := hex.EncodeToString(h.Sum(nil))
	if sum != hash {
		return fmt.Errorf("checksum for plugin file %s does not match signature checksum", path)
	}

	return nil
}

func UrlMatch(specs []string, target string, signatureType SignatureType) (bool, error) {
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

		if signatureType != PrivateGlobSignatureType {
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

func validateManifest(m PluginManifest, block *clearsign.Block) error {
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
	if m.IsV2() {
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
