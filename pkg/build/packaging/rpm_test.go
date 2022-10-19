package packaging

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/stretchr/testify/require"
)

const pubKey = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: OpenPGP.js v4.10.10
Comment: https://openpgpjs.org

xsBNBGM1b9wBCADZM49X7vwOS93KbgA6yhpwrYf8ZlzksGcDaYgp1IzvqHbs
xeU1mmBYVH/bSKRDG0tt3Qdky4Nvl4Oqd+g0e2ZGjmlEy9zUiPTTK/BtXT+5
s8oqih2NIAkyF91BNZABAgvh/vJdYImhYeUQBDqMJgqZ/Y/Ha31N7rSW+jUt
LHspbN0ztJYjuEd/bg2NKH7Gs/AyNvX9IQTC4k7iRRafx7q/PBCVtsk+NCwz
BEkL93xpAdcdYiMNrRP2eIHQjBmNZ/oUCkcDsLCBvcSq6P2lGpNnpPzVoTJf
v2qrWkVn5txJJsOkmBGpEDbECPunVilrWO6RPomP0yYkr6NE4XeCJ3QhABEB
AAHNGWR1bW15IDxkdW1teUBob3RtYWlsLmNvbT7CwI0EEAEIACAFAmM1b9wG
CwkHCAMCBBUICgIEFgIBAAIZAQIbAwIeAQAhCRAoJ1i5w6kkAxYhBCQv+iwt
IFn7vj9PLygnWLnDqSQDPxkH/0Ju2Cah+bOxl09uv2Ft2BVlQh0u+wJyRVgs
KxTxldAXFZwMrN4wK/GUoGWDiy2tzNtoVE6GpxWUj+LvSGFaVLNVjW+Le77I
BP/sl1wKHJbQhseKc7Mz5Zj3i0F1FPM+rLik7tNk6kiEBqYVyyXahyT98Hu1
1OKEV+8NiRG47iNgd/dpgEdVSS4DN/dL6m5q+CVy9YnlR+wXxF/2xcMmWBzR
V2cPVw0JzunpUV8lDDQ/n1sPw61D3oL1aH0bkn8aA8pEceKOVIYOaja7LkLX
uSlROlALA/M2fuubradW9I3FcrJNn+/xA52el2l/Hn/Syf9GQV/Ll/R+qKIo
Z57xWd7OwE0EYzVv3AEIAJl/PNYOF2prNKY58BfZ74XurDb9mNlZ1wsIqrOu
J/euzHEnzkCAjMUuXV7wcugjQlmpcZn6Y0QmQ2uX7SwPCMovDvngbXeAfbdd
6FUKecQ0sG54Plm8HSMNdjetdUVl7ACxjJO8Rdc/Asx7ua7gMm42CVfqMj4L
qN5foUBlaKJ1iGKUpQ+673UQWMYeOBuu9G8awbSzGaphN97CIX7xEMGzGeff
yHLHK+MsfX935uDgDwJQzxJKEugIJDMKgWOLgVz1jRCsJKHlywHTWpVuMiKY
Wnuq4tDNLBUQtaRL7uclG7Wejw/XNN0uD/zNHPgF5rmlYHVhrtDbBCP2XqTn
WU8AEQEAAcLAdgQYAQgACQUCYzVv3AIbDAAhCRAoJ1i5w6kkAxYhBCQv+iwt
IFn7vj9PLygnWLnDqSQDFqYH/AkdNaPUQlE7RQBigNRGOFBuqjhbLsV/rZf+
/4K6wDHojM606lgLm57T4NUXnk53VIF3KO8+v8N11mCtPb+zBngfvVU14COC
HEDNdOK19TlR+tH25cftfUiF+OJsgMQysErGuFEtwLE6TNzpQIcnw7SbjxMr
EGacF9xCBKexB6MlR3GwJ2LBUJm3Lq/fvqImztoTlKDsrpk4JOH5FfYG+G2f
1zU73fVsCCElX4qA/49rRQf0RNfhjRjmHULP8hSvCXUEhfiBggEgxof/vKlC
qauHC55luuIeabju8HaXTjpz019cq+3IUgewX/ky0PhQXEW9SoODKabPY2yS
yUbHFm4=
=OCSx
-----END PGP PUBLIC KEY BLOCK-----
`

const privKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: OpenPGP.js v4.10.10
Comment: https://openpgpjs.org

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
RscWbg==
=KJNy
-----END PGP PRIVATE KEY BLOCK-----
`

// Dummy GPG keys, used only for testing
// nolint:gosec
const passPhrase = `MkDgjkrgdGxt`

func TestSignRPMRepo(t *testing.T) {
	repoDir := t.TempDir()
	workDir := t.TempDir()
	pubKeyPath := filepath.Join(workDir, "pub.key")
	err := os.WriteFile(pubKeyPath, []byte(pubKey), 0600)
	require.NoError(t, err)
	privKeyPath := filepath.Join(workDir, "priv.key")
	err = os.WriteFile(privKeyPath, []byte(privKey), 0600)
	require.NoError(t, err)
	passPhrasePath := filepath.Join(workDir, "passphrase")
	err = os.WriteFile(passPhrasePath, []byte(passPhrase), 0600)
	require.NoError(t, err)
	err = os.Mkdir(filepath.Join(repoDir, "repodata"), 0700)
	require.NoError(t, err)
	err = os.WriteFile(filepath.Join(repoDir, "repodata", "repomd.xml"), []byte("<xml></xml>"), 0600)
	require.NoError(t, err)

	cfg := PublishConfig{
		Config: config.Config{
			GPGPrivateKey: privKeyPath,
			GPGPublicKey:  pubKeyPath,
			GPGPassPath:   passPhrasePath,
		},
	}

	err = signRPMRepo(repoDir, cfg)
	require.NoError(t, err)
}
