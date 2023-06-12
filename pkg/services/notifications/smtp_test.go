package notifications

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
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

func TestSmtpDialer(t *testing.T) {
	t.Run("When SMTP hostname is invalid", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Host = "invalid%hostname:123:456"
		client, err := ProvideSmtpService(cfg)
		require.NoError(t, err)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "address invalid%hostname:123:456: too many colons in address")
	})

	t.Run("When SMTP port is invalid", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Host = "invalid%hostname:123a"
		client, err := ProvideSmtpService(cfg)
		require.NoError(t, err)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "strconv.Atoi: parsing \"123a\": invalid syntax")
	})

	t.Run("When TLS certificate does not exist", func(t *testing.T) {
		cfg := createSmtpConfig()
		cfg.Smtp.Host = "localhost:1234"
		cfg.Smtp.CertFile = "/var/certs/does-not-exist.pem"
		client, err := ProvideSmtpService(cfg)
		require.NoError(t, err)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "could not load cert or key file: open /var/certs/does-not-exist.pem: no such file or directory")
	})
}
