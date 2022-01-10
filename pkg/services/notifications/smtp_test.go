package notifications

import (
	"bytes"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildMail(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}

	sc, err := NewSmtpClient(cfg.Smtp)
	require.NoError(t, err)

	message := &Message{
		To:      []string{"to@address.com"},
		From:    "from@address.com",
		Subject: "Some subject",
		Body: map[string]string{
			"text/html":  "Some HTML body",
			"text/plain": "Some plain text body",
		},
		ReplyTo: []string{"from@address.com"},
	}

	t.Run("When building email", func(t *testing.T) {
		email := sc.buildEmail(message)

		buf := new(bytes.Buffer)
		_, err := email.WriteTo(buf)
		require.NoError(t, err)

		assert.Contains(t, buf.String(), "Some HTML body")
		assert.Contains(t, buf.String(), "Some plain text body")
		assert.Less(t, strings.Index(buf.String(), "Some plain text body"), strings.Index(buf.String(), "Some HTML body"))
	})
}
