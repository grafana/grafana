package sourcev1

import (
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHintSignature(t *testing.T) {
	at := time.Unix(1761911000, 0)
	body := []byte(`{"type":"revision","revision":"b81d03c2ee"}`)
	timestamp := strconv.FormatInt(at.Unix(), 10)
	signature := SignHint("secret", at, body)

	assert.True(t, VerifyHintSignature("secret", timestamp, body, signature))

	tests := []struct {
		name      string
		secret    string
		timestamp string
		body      []byte
		signature string
	}{
		{"wrong secret", "other", timestamp, body, signature},
		{"other timestamp", "secret", "1761911001", body, signature},
		{"other body", "secret", timestamp, []byte(`{}`), signature},
		{"no prefix", "secret", timestamp, body, signature[len("sha256="):]},
		{"not hex", "secret", timestamp, body, "sha256=zz"},
		{"empty", "secret", timestamp, body, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.False(t, VerifyHintSignature(tt.secret, tt.timestamp, tt.body, tt.signature))
		})
	}
}
