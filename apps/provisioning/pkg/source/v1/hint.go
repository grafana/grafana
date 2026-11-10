package sourcev1

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"time"
)

// Headers of a signed change hint, sent by a source to a repository's webhook endpoint.
const (
	HeaderHintTimestamp = "X-Source-Timestamp"
	HeaderHintDelivery  = "X-Source-Delivery"
	HeaderHintSignature = "X-Source-Signature"
)

// HintTolerance is how far a hint's timestamp may be from the receiver's clock.
const HintTolerance = 5 * time.Minute

// Hint types.
const (
	HintRevision = "revision"
	HintPing     = "ping"
)

// Hint is the body of a change hint. It carries a revision only, never contents or a
// change list, so a dropped hint costs one poll interval.
type Hint struct {
	Type     string `json:"type"`
	Revision string `json:"revision,omitempty"`
	// ID is the source id; when set it must match the repository's source.
	ID string `json:"id,omitempty"`
}

// SignHint returns the header value for a hint: sha256= and the hex HMAC-SHA256 of
// the timestamp, a dot and the body.
func SignHint(secret string, at time.Time, body []byte) string {
	return "sha256=" + hex.EncodeToString(hintMAC(secret, strconv.FormatInt(at.Unix(), 10), body))
}

// VerifyHintSignature compares a header value to the expected signature in constant time.
func VerifyHintSignature(secret, timestamp string, body []byte, signature string) bool {
	const prefix = "sha256="
	if len(signature) <= len(prefix) || signature[:len(prefix)] != prefix {
		return false
	}
	got, err := hex.DecodeString(signature[len(prefix):])
	if err != nil {
		return false
	}
	return hmac.Equal(got, hintMAC(secret, timestamp, body))
}

func hintMAC(secret, timestamp string, body []byte) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp + "."))
	mac.Write(body)
	return mac.Sum(nil)
}
