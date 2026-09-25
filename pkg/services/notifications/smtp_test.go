package notifications

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/textproto"
	"sort"
	"strings"
	"testing"
	"time"

	smtpmock "github.com/mocktools/go-smtp-mock/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

type failingConfigProvider struct {
	configprovider.ConfigProvider
	err error
}

func (p failingConfigProvider) GetSections(context.Context, ...string) (*ini.File, error) {
	return nil, p.err
}

func newTestSmtpClient(t *testing.T, cfg *setting.Cfg) *SmtpClient {
	t.Helper()
	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	sc, err := NewSmtpClient(cfg, cfgProvider)
	require.NoError(t, err)
	return sc
}

// smtpRawCfg returns a cfg whose live [smtp] section holds smtpKeys.
func smtpRawCfg(t *testing.T, smtpKeys map[string]string) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	setRawKeys(t, cfg, "smtp", smtpKeys)
	return cfg
}

// setRawKeys adds or overwrites keys in cfg.Raw, which is what the OSS config
// provider serves, so tests can change live settings between calls.
func setRawKeys(t *testing.T, cfg *setting.Cfg, section string, keys map[string]string) {
	t.Helper()
	sec := cfg.Raw.Section(section)
	for name, value := range keys {
		_, err := sec.NewKey(name, value)
		require.NoError(t, err)
	}
}

func sentHeaders(t *testing.T, sentMsg smtpmock.Message) textproto.MIMEHeader {
	t.Helper()
	hdr, err := textproto.NewReader(bufio.NewReader(strings.NewReader(sentMsg.MsgRequest()))).ReadMIMEHeader()
	require.NoError(t, err)
	return hdr
}

func TestBuildMail(t *testing.T) {
	sc := newTestSmtpClient(t, setting.NewCfg())

	smtp := setting.SmtpSettings{
		StaticHeaders: map[string]string{"Foo-Header": "foo_value", "From": "malicious_value"},
	}

	message := &Message{
		To:           []string{"to@address.com"},
		From:         "Mr. Foo <from@address.com>",
		Subject:      "Some subject",
		ContentTypes: []string{"text/html", "text/plain"},
		Body: map[string]string{
			"text/html":  "Some HTML body",
			"text/plain": "Some plain text body",
		},
		ReplyTo: []string{"from@address.com"},
	}

	ctx := context.Background()

	t.Run("Uses only the content types listed on the message", func(t *testing.T) {
		plainOnly := *message
		plainOnly.ContentTypes = []string{"text/plain"}

		buf := new(bytes.Buffer)
		_, err := sc.buildEmail(ctx, smtp, &plainOnly).WriteTo(buf)
		require.NoError(t, err)

		assert.Contains(t, buf.String(), "Some plain text body")
		assert.NotContains(t, buf.String(), "Some HTML body")
	})

	t.Run("Can successfully build mail", func(t *testing.T) {
		email := sc.buildEmail(ctx, smtp, message)
		staticHeader := email.GetHeader("Foo-Header")[0]
		assert.Equal(t, staticHeader, "foo_value")

		buf := new(bytes.Buffer)
		_, err := email.WriteTo(buf)
		require.NoError(t, err)

		assert.Contains(t, buf.String(), "Foo-Header: foo_value")
		assert.Contains(t, buf.String(), "From: Mr. Foo <from@address.com>")
		assert.Regexp(t, "Message-ID: <.*@address.com>", buf.String())
		assert.Contains(t, buf.String(), "Some HTML body")
		assert.Contains(t, buf.String(), "Some plain text body")
		assert.Less(t, strings.Index(buf.String(), "Some plain text body"), strings.Index(buf.String(), "Some HTML body"))
	})

	tracingSmtp := smtp
	tracingSmtp.EnableTracing = true

	t.Run("Skips trace headers when context has no span", func(t *testing.T) {
		email := sc.buildEmail(ctx, tracingSmtp, message)
		assert.Empty(t, email.GetHeader("traceparent"))
	})

	t.Run("Adds trace headers when context has span", func(t *testing.T) {
		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		email := sc.buildEmail(ctx, tracingSmtp, message)
		assert.NotEmpty(t, email.GetHeader("traceparent"))
	})
}

func TestSmtpDialer(t *testing.T) {
	ctx := context.Background()

	t.Run("When SMTP hostname is invalid", func(t *testing.T) {
		cfg := smtpRawCfg(t, map[string]string{"enabled": "true", "host": "invalid%hostname:123:456"})
		client := newTestSmtpClient(t, cfg)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(ctx, message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "address invalid%hostname:123:456: too many colons in address")
	})

	t.Run("When SMTP port is invalid", func(t *testing.T) {
		cfg := smtpRawCfg(t, map[string]string{"enabled": "true", "host": "invalid%hostname:123a"})
		client := newTestSmtpClient(t, cfg)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(ctx, message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "strconv.Atoi: parsing \"123a\": invalid syntax")
	})

	t.Run("When TLS certificate does not exist", func(t *testing.T) {
		cfg := smtpRawCfg(t, map[string]string{
			"enabled":   "true",
			"host":      "localhost:1234",
			"cert_file": "/var/certs/does-not-exist.pem",
		})
		client := newTestSmtpClient(t, cfg)
		message := &Message{
			To:          []string{"asdf@grafana.com"},
			SingleEmail: true,
			Subject:     "subject",
			Body: map[string]string{
				"text/html":  "body",
				"text/plain": "body",
			},
		}

		count, err := client.Send(ctx, message)

		require.Equal(t, 0, count)
		require.EqualError(t, err, "could not load cert or key file: open /var/certs/does-not-exist.pem: no such file or directory")
	})
}

func TestSmtpSend(t *testing.T) {
	srv := smtpmock.New(smtpmock.ConfigurationAttr{
		MultipleRcptto: true,
		HostAddress:    "127.0.0.1",
	})
	require.NoError(t, srv.Start())
	defer func() { _ = srv.Stop() }()

	cfg := smtpRawCfg(t, map[string]string{
		"enabled":        "true",
		"host":           fmt.Sprintf("127.0.0.1:%d", srv.PortNumber()),
		"enable_tracing": "true",
	})

	client := newTestSmtpClient(t, cfg)

	ctx := context.Background()

	t.Run("single message sends", func(t *testing.T) {
		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		message := &Message{
			From:         "from@example.com",
			To:           []string{"rcpt@example.com"},
			Subject:      "subject",
			ContentTypes: []string{"text/plain"},
			Body:         map[string]string{"text/plain": "hello world"},
		}

		count, err := client.Send(ctx, message)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		messages, err := srv.WaitForMessagesAndPurge(1, 5*time.Second)
		require.NoError(t, err)
		require.Len(t, messages, 1)
		sentMsg := messages[0]

		// read the headers
		r := bufio.NewReader(strings.NewReader(sentMsg.MsgRequest()))
		mimeReader := textproto.NewReader(r)
		hdr, err := mimeReader.ReadMIMEHeader()
		require.NoError(t, err)

		// make sure the trace is propagated
		traceId := span.SpanContext().TraceID().String()
		hasPrefix := strings.HasPrefix(hdr.Get("traceparent"), "00-"+traceId+"-")
		require.True(t, hasPrefix)

		// one of the lines should be the body we expect!
		found := false
		for {
			line, err := mimeReader.ReadLine()
			if errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)

			t.Logf("line: %q", line)
			if strings.Contains(line, "hello world") {
				found = true
				break
			}
		}

		require.True(t, found)
	})

	t.Run("multiple recipients, single message", func(t *testing.T) {
		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		message := &Message{
			From:         "from@example.com",
			To:           []string{"rcpt1@example.com", "rcpt2@example.com", "rcpt3@example.com"},
			Subject:      "subject",
			ContentTypes: []string{"text/plain"},
			Body:         map[string]string{"text/plain": "hello world"},
		}

		count, err := client.Send(ctx, message)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		messages, err := srv.WaitForMessagesAndPurge(1, 5*time.Second)
		require.NoError(t, err)
		require.Len(t, messages, 1)
		sentMsg := messages[0]

		rcpts := sentMsg.RcpttoRequestResponse()
		require.EqualValues(t, [][]string{
			{"RCPT TO:<rcpt1@example.com>", "250 Received"},
			{"RCPT TO:<rcpt2@example.com>", "250 Received"},
			{"RCPT TO:<rcpt3@example.com>", "250 Received"},
		}, rcpts)

		// read the headers
		r := bufio.NewReader(strings.NewReader(sentMsg.MsgRequest()))
		mimeReader := textproto.NewReader(r)
		hdr, err := mimeReader.ReadMIMEHeader()
		require.NoError(t, err)

		// make sure the trace is propagated
		traceId := span.SpanContext().TraceID().String()
		hasPrefix := strings.HasPrefix(hdr.Get("traceparent"), "00-"+traceId+"-")
		require.True(t, hasPrefix)

		// one of the lines should be the body we expect!
		found := false
		for {
			line, err := mimeReader.ReadLine()
			if errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)

			t.Logf("line: %q", line)
			if strings.Contains(line, "hello world") {
				found = true
				break
			}
		}

		require.True(t, found)
	})

	t.Run("multiple recipients, multiple messages", func(t *testing.T) {
		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		msgs := []*Message{
			{From: "from@example.com", To: []string{"rcpt1@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rcpt2@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rcpt3@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
		}

		count, err := client.Send(ctx, msgs...)
		require.NoError(t, err)
		assert.Equal(t, 3, count)

		messages, err := srv.WaitForMessagesAndPurge(3, 5*time.Second)
		require.NoError(t, err)
		assert.Len(t, messages, 3)

		// sort for test consistency
		sort.Slice(messages, func(i, j int) bool {
			return messages[i].RcpttoRequestResponse()[0][0] < messages[j].RcpttoRequestResponse()[0][0]
		})

		for i, sentMsg := range messages {
			rcpts := sentMsg.RcpttoRequestResponse()
			assert.EqualValues(t, [][]string{
				{fmt.Sprintf("RCPT TO:<rcpt%d@example.com>", i+1), "250 Received"},
			}, rcpts)

			// read the headers
			r := bufio.NewReader(strings.NewReader(sentMsg.MsgRequest()))
			mimeReader := textproto.NewReader(r)
			hdr, err := mimeReader.ReadMIMEHeader()
			require.NoError(t, err)

			// make sure the trace is propagated
			traceId := span.SpanContext().TraceID().String()
			hasPrefix := strings.HasPrefix(hdr.Get("traceparent"), "00-"+traceId+"-")
			assert.True(t, hasPrefix)

			// one of the lines should be the body we expect!
			found := false
			for {
				line, err := mimeReader.ReadLine()
				if errors.Is(err, io.EOF) {
					break
				}
				require.NoError(t, err)

				t.Logf("line: %q", line)
				if strings.Contains(line, "hello world") {
					found = true
					break
				}
			}

			assert.True(t, found)
		}
	})
}

func TestSmtpSendPartialFailure(t *testing.T) {
	srv := smtpmock.New(smtpmock.ConfigurationAttr{
		HostAddress:               "127.0.0.1",
		BlacklistedRcpttoEmails:   []string{"rejected@example.com"},
		MsgRcpttoBlacklistedEmail: "550 5.1.1 User unknown",
	})
	require.NoError(t, srv.Start())
	defer func() { _ = srv.Stop() }()

	cfg := smtpRawCfg(t, map[string]string{
		"enabled": "true",
		"host":    fmt.Sprintf("127.0.0.1:%d", srv.PortNumber()),
	})

	client := newTestSmtpClient(t, cfg)

	ctx := context.Background()

	t.Run("rejected recipient does not block the remaining messages", func(t *testing.T) {
		msgs := []*Message{
			{From: "from@example.com", To: []string{"rcpt1@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rejected@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rcpt3@example.com"},
				Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}},
		}

		count, err := client.Send(ctx, msgs...)
		require.Equal(t, 2, count)
		require.ErrorContains(t, err, "5.1.1 User unknown")

		// every SMTP session is recorded, but only the two accepted
		// recipients have consistent (fully delivered) messages
		messages, err := srv.WaitForMessagesAndPurge(3, 5*time.Second)
		require.NoError(t, err)

		var delivered []string
		for _, sentMsg := range messages {
			if sentMsg.IsConsistent() {
				delivered = append(delivered, sentMsg.RcpttoRequestResponse()[0][0])
			}
		}
		sort.Strings(delivered)
		require.Equal(t, []string{
			"RCPT TO:<rcpt1@example.com>",
			"RCPT TO:<rcpt3@example.com>",
		}, delivered)
	})
}

func TestSmtpSendLiveSettings(t *testing.T) {
	srv := smtpmock.New(smtpmock.ConfigurationAttr{HostAddress: "127.0.0.1"})
	require.NoError(t, srv.Start())
	defer func() { _ = srv.Stop() }()

	ctx := context.Background()
	newMessage := func() *Message {
		return &Message{From: "from@example.com", To: []string{"rcpt@example.com"},
			Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}}
	}
	newLiveCfg := func(t *testing.T) *setting.Cfg {
		t.Helper()
		return smtpRawCfg(t, map[string]string{
			"enabled": "true",
			"host":    fmt.Sprintf("127.0.0.1:%d", srv.PortNumber()),
		})
	}

	t.Run("applies settings changed between sends", func(t *testing.T) {
		cfg := newLiveCfg(t)
		setRawKeys(t, cfg, "smtp.static_headers", map[string]string{"X-Test": "first"})
		client := newTestSmtpClient(t, cfg)

		_, err := client.Send(ctx, newMessage())
		require.NoError(t, err)
		setRawKeys(t, cfg, "smtp.static_headers", map[string]string{"X-Test": "second"})
		_, err = client.Send(ctx, newMessage())
		require.NoError(t, err)

		messages, err := srv.WaitForMessagesAndPurge(2, 5*time.Second)
		require.NoError(t, err)
		require.Len(t, messages, 2)
		assert.Equal(t, "first", sentHeaders(t, messages[0]).Get("X-Test"))
		assert.Equal(t, "second", sentHeaders(t, messages[1]).Get("X-Test"))
	})

	t.Run("stops sending once SMTP is disabled", func(t *testing.T) {
		cfg := newLiveCfg(t)
		client := newTestSmtpClient(t, cfg)

		setRawKeys(t, cfg, "smtp", map[string]string{"enabled": "false"})
		count, err := client.Send(ctx, newMessage())

		require.ErrorIs(t, err, ErrSmtpNotEnabled)
		assert.Equal(t, 0, count)
		assert.Empty(t, srv.MessagesAndPurge())
	})

	t.Run("uses the instance name as EHLO identity when ehlo_identity is unset", func(t *testing.T) {
		cfg := newLiveCfg(t)
		cfg.InstanceName = "test-instance.example.com"
		client := newTestSmtpClient(t, cfg)

		_, err := client.Send(ctx, newMessage())
		require.NoError(t, err)

		messages, err := srv.WaitForMessagesAndPurge(1, 5*time.Second)
		require.NoError(t, err)
		require.Len(t, messages, 1)
		assert.Equal(t, "EHLO test-instance.example.com", messages[0].HeloRequest())
	})

	t.Run("rejects an invalid static header without sending", func(t *testing.T) {
		cfg := newLiveCfg(t)
		setRawKeys(t, cfg, "smtp.static_headers", map[string]string{"invalid header": "value"})
		client := newTestSmtpClient(t, cfg)

		count, err := client.Send(ctx, newMessage())

		require.ErrorContains(t, err, "must follow canonical MIME form")
		assert.Equal(t, 0, count)
		assert.Empty(t, srv.MessagesAndPurge())
	})

	t.Run("returns the config provider error without sending", func(t *testing.T) {
		providerErr := errors.New("settings unavailable")
		client, err := NewSmtpClient(setting.NewCfg(), failingConfigProvider{err: providerErr})
		require.NoError(t, err)

		count, err := client.Send(ctx, newMessage())

		require.ErrorIs(t, err, providerErr)
		assert.Equal(t, 0, count)
		assert.Empty(t, srv.MessagesAndPurge())
	})
}
