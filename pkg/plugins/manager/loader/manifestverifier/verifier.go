package manifestverifier

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
)

// ManifestKeys is the database representation of public keys
// used to verify plugin manifests.
type ManifestKeys struct {
	KeyID     string `json:"keyId"`
	PublicKey string `json:"public"`
	Since     int64  `json:"since"`
}

type ManifestVerifier struct {
	lock       sync.Mutex
	publicKeys map[string]ManifestKeys
	features   plugins.FeatureToggles
	grafanaURL string
}

func New(features plugins.FeatureToggles, grafanaURL string) *ManifestVerifier {
	return &ManifestVerifier{
		features:   features,
		grafanaURL: grafanaURL,
		publicKeys: map[string]ManifestKeys{},
	}
}

// getPublicKey loads public keys from:
//   - The hard-coded value if the feature flag is not enabled.
//   - (TODO) The database if it has been already retrieved.
//   - The Grafana.com API if the database is empty.
func (pmv *ManifestVerifier) GetPublicKey(keyID string) (string, error) {
	pmv.lock.Lock()
	defer pmv.lock.Unlock()

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
	if !pmv.features.IsEnabled("pluginsAPIManifestKey") {
		return publicKeyText, nil
	}

	key, exist := pmv.publicKeys[keyID]
	if exist {
		return key.PublicKey, nil
	}

	// Retrieve the key from the API and store it in the database
	var data struct {
		Items []ManifestKeys
	}

	resp, err := http.Get(pmv.grafanaURL + "/api/plugins/ci/keys")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	if len(data.Items) == 0 {
		return "", errors.New("missing public key")
	}

	for _, key := range data.Items {
		pmv.publicKeys[key.KeyID] = key
	}

	key, exist = pmv.publicKeys[keyID]
	if exist {
		return key.PublicKey, nil
	}

	return "", fmt.Errorf("missing public key for %s", keyID)
}
