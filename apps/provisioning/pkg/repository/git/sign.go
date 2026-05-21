package git

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/ProtonMail/go-crypto/openpgp"
	"github.com/grafana/nanogit"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// gpgCommitModifier returns a nanogit.CommitModifier that signs commit bytes
// with the given armored OpenPGP private key. The signature is embedded as a
// gpgsig header so the resulting commit hash includes it. The key must be
// unencrypted; passphrase-protected keys are rejected at construction time.
func gpgCommitModifier(armoredKey common.RawSecureValue) (nanogit.CommitModifier, error) {
	entities, err := openpgp.ReadArmoredKeyRing(strings.NewReader(string(armoredKey)))
	if err != nil {
		return nil, fmt.Errorf("read armored signing key: %w", err)
	}
	if len(entities) == 0 {
		return nil, fmt.Errorf("no entities found in signing key")
	}
	signer := entities[0]
	if signer.PrivateKey == nil {
		return nil, fmt.Errorf("signing key has no private component")
	}
	if signer.PrivateKey.Encrypted {
		return nil, fmt.Errorf("signing key is passphrase-protected")
	}

	return func(unsigned []byte) ([]byte, error) {
		var sig bytes.Buffer
		if err := openpgp.ArmoredDetachSign(&sig, signer, bytes.NewReader(unsigned), nil); err != nil {
			return nil, fmt.Errorf("sign commit: %w", err)
		}
		return spliceGPGSig(unsigned, sig.String()), nil
	}, nil
}

// spliceGPGSig embeds an armored signature as a gpgsig header in canonical
// git commit bytes. Continuation lines are indented with a single space per
// Git's header-folding convention.
func spliceGPGSig(unsigned []byte, armoredSig string) []byte {
	boundary := bytes.Index(unsigned, []byte("\n\n"))
	if boundary < 0 {
		boundary = len(unsigned)
	}
	lines := strings.Split(strings.TrimRight(armoredSig, "\n"), "\n")
	var b bytes.Buffer
	b.Grow(len(unsigned) + len(armoredSig) + len(lines) + 8)
	b.Write(unsigned[:boundary])
	b.WriteByte('\n')
	b.WriteString("gpgsig ")
	b.WriteString(lines[0])
	for _, line := range lines[1:] {
		b.WriteByte('\n')
		b.WriteByte(' ')
		b.WriteString(line)
	}
	b.Write(unsigned[boundary:])
	return b.Bytes()
}
