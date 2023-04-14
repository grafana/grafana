package manifestverifier

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/ProtonMail/go-crypto/openpgp/clearsign"
	"github.com/ProtonMail/go-crypto/openpgp/packet"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// ManifestKeys is the database representation of public keys
// used to verify plugin manifests.
type ManifestKeys struct {
	KeyID     string `json:"keyId"`
	PublicKey string `json:"public"`
	Since     int64  `json:"since"`
}

type ManifestVerifier struct {
	cfg  *config.Cfg
	mlog log.Logger

	lock       sync.Mutex
	cli        http.Client
	publicKeys map[string]ManifestKeys
}

func New(cfg *config.Cfg, mlog log.Logger) *ManifestVerifier {
	return &ManifestVerifier{
		cfg:        cfg,
		publicKeys: map[string]ManifestKeys{},
		mlog:       mlog,
		cli:        makeHttpClient(),
	}
}

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

// getPublicKey loads public keys from:
//   - The hard-coded value if the feature flag is not enabled.
//   - A cached value from memory if it has been already retrieved.
//   - The Grafana.com API if the database is empty.
func (pmv *ManifestVerifier) GetPublicKey(keyID string) (string, error) {
	pmv.lock.Lock()
	defer pmv.lock.Unlock()

	if pmv.cfg == nil || pmv.cfg.Features == nil || !pmv.cfg.Features.IsEnabled("pluginsAPIManifestKey") {
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

	url, err := url.JoinPath(pmv.cfg.GrafanaComURL, "/api/plugins/ci/keys") // nolint:gosec URL is provided by config
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	resp, err := pmv.cli.Do(req)
	if err != nil {
		return "", err
	}
	defer func() {
		err := resp.Body.Close()
		if err != nil {
			pmv.mlog.Warn("error closing response body", "error", err)
		}
	}()

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

func (pmv *ManifestVerifier) Verify(keyID string, block *clearsign.Block) error {
	publicKey, err := pmv.GetPublicKey(keyID)
	if err != nil {
		return err
	}

	keyring, err := openpgp.ReadArmoredKeyRing(bytes.NewBufferString(publicKey))
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to parse public key", err)
	}

	if _, err = openpgp.CheckDetachedSignature(keyring,
		bytes.NewBuffer(block.Bytes),
		block.ArmoredSignature.Body, &packet.Config{}); err != nil {
		return fmt.Errorf("%v: %w", "failed to check signature", err)
	}

	return nil
}

// Same configuration as pkg/plugins/repo/client.go
func makeHttpClient() http.Client {
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return http.Client{
		Timeout:   10 * time.Second,
		Transport: tr,
	}
}
