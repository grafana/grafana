package oauth

import (
	"encoding/json"
	"errors"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

var ErrNoToken = errors.New("no token available")

// TokenPayload is the value stored in the connection's secure token for OAuth
// app connections. It bundles the short-lived access token with the refresh
// token used to mint the next one, since both must survive controller restarts
// and refresh-token rotation.
type TokenPayload struct {
	AccessToken  string    `json:"accessToken"`
	RefreshToken string    `json:"refreshToken"`
	IssuedAt     time.Time `json:"issuedAt"`
	ExpiresAt    time.Time `json:"expiresAt"`
}

// ParseToken decodes a stored token payload. A raw non-JSON value is treated as
// a bare refresh token from the initial authorization grant.
func ParseToken(raw common.RawSecureValue) (TokenPayload, error) {
	if raw.IsZero() {
		return TokenPayload{}, ErrNoToken
	}

	var p TokenPayload
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		return TokenPayload{RefreshToken: string(raw)}, nil
	}

	return p, nil
}

func (p TokenPayload) Marshal() (common.RawSecureValue, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return common.RawSecureValue(b), nil
}
