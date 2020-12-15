package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	macaron "gopkg.in/macaron.v1"
)

// addCSPHeader adds the Content Security Policy header.
func addCSPHeader(c *macaron.Context, w macaron.ResponseWriter, cfg *setting.Cfg) error {
	if !cfg.CSPEnabled {
		return nil
	}

	if cfg.CSPTemplate == "" {
		return fmt.Errorf("CSP template has to be configured")
	}

	var buf [16]byte
	if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
		return fmt.Errorf("failed to generate CSP nonce: %w", err)
	}
	nonce := base64.RawStdEncoding.EncodeToString(buf[:])
	val := strings.ReplaceAll(cfg.CSPTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))
	w.Header().Set("Content-Security-Policy", val)

	ctx, ok := c.Data["ctx"].(*models.ReqContext)
	if !ok {
		return fmt.Errorf("failed to convert context into models.ReqContext")
	}

	ctx.RequestNonce = nonce

	return nil
}
