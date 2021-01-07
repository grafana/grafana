package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	macaron "gopkg.in/macaron.v1"
)

// AddCSPHeader adds the Content Security Policy header.
func AddCSPHeader(cfg *setting.Cfg) macaron.Handler {
	return func(w http.ResponseWriter, req *http.Request, c *macaron.Context) {
		if !cfg.CSPEnabled {
			return
		}

		ctx, ok := c.Data["ctx"].(*models.ReqContext)
		if !ok {
			panic("Failed to convert context into models.ReqContext")
		}

		if cfg.CSPTemplate == "" {
			ctx.JsonApiErr(403, "CSP template has to be configured", nil)
			return
		}

		var buf [16]byte
		if _, err := io.ReadFull(rand.Reader, buf[:]); err != nil {
			ctx.JsonApiErr(500, "Failed to generate CSP nonce", err)
		}
		nonce := base64.RawStdEncoding.EncodeToString(buf[:])
		val := strings.ReplaceAll(cfg.CSPTemplate, "$NONCE", fmt.Sprintf("'nonce-%s'", nonce))
		w.Header().Set("Content-Security-Policy", val)

		ctx.RequestNonce = nonce
	}
}
