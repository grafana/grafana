package notifications

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/textproto"
	"strings"
	"testing"
	"time"

	smtpmock "github.com/mocktools/go-smtp-mock/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBuildMail(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Smtp.ContentTypes = []string{"text/html", "text/plain"}
	cfg.Smtp.StaticHeaders = map[string]string{"Foo-Header": "foo_value", "From": "malicious_value"}

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

	ctx := context.Background()

	t.Run("Can successfully build mail", func(t *testing.T) {
		email := sc.buildEmail(ctx, message)
		staticHeader := email.GetHeader("Foo-Header")[0]
		assert.Equal(t, staticHeader, "foo_value")

		buf := new(bytes.Buffer)
		_, err := email.WriteTo(buf)
		require.NoError(t, err)

		assert.Contains(t, buf.String(), "Foo-Header: foo_value")
		assert.Contains(t, buf.String(), "From: from@address.com")
		assert.Contains(t, buf.String(), "Some HTML body")
		assert.Contains(t, buf.String(), "Some plain text body")
		assert.Less(t, strings.Index(buf.String(), "Some plain text body"), strings.Index(buf.String(), "Some HTML body"))
	})

	t.Run("Skips trace headers when context has no span", func(t *testing.T) {
		cfg.Smtp.EnableTracing = true

		sc, err := NewSmtpClient(cfg.Smtp)
		require.NoError(t, err)

		email := sc.buildEmail(ctx, message)
		assert.Empty(t, email.GetHeader("traceparent"))
	})

	t.Run("Adds trace headers when context has span", func(t *testing.T) {
		cfg.Smtp.EnableTracing = true

		sc, err := NewSmtpClient(cfg.Smtp)
		require.NoError(t, err)

		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		email := sc.buildEmail(ctx, message)
		assert.NotEmpty(t, email.GetHeader("traceparent"))
	})
}

func TestSmtpDialer(t *testing.T) {
	ctx := context.Background()

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

		count, err := client.Send(ctx, message)

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

		count, err := client.Send(ctx, message)

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

	cfg := createSmtpConfig()
	cfg.Smtp.Host = fmt.Sprintf("127.0.0.1:%d", srv.PortNumber())
	cfg.Smtp.EnableTracing = true

	client, err := NewSmtpClient(cfg.Smtp)
	require.NoError(t, err)

	ctx := context.Background()

	t.Run("single message sends", func(t *testing.T) {
		tracer := tracing.InitializeTracerForTest()
		ctx, span := tracer.Start(ctx, "notifications.SmtpClient.SendContext")
		defer span.End()

		message := &Message{
			From:    "from@example.com",
			To:      []string{"rcpt@example.com"},
			Subject: "subject",
			Body:    map[string]string{"text/plain": "hello world"},
		}

		count, err := client.Send(ctx, message)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		// workaround for https://github.com/mocktools/go-smtp-mock/issues/181
		time.Sleep(1 * time.Millisecond)
		messages := srv.MessagesAndPurge()
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
			From:    "from@example.com",
			To:      []string{"rcpt1@example.com", "rcpt2@example.com", "rcpt3@example.com"},
			Subject: "subject",
			Body:    map[string]string{"text/plain": "hello world"},
		}

		count, err := client.Send(ctx, message)
		require.NoError(t, err)
		require.Equal(t, 1, count)

		// workaround for https://github.com/mocktools/go-smtp-mock/issues/181
		time.Sleep(1 * time.Millisecond)
		messages := srv.MessagesAndPurge()
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
				Subject: "subject", Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rcpt2@example.com"},
				Subject: "subject", Body: map[string]string{"text/plain": "hello world"}},
			{From: "from@example.com", To: []string{"rcpt3@example.com"},
				Subject: "subject", Body: map[string]string{"text/plain": "hello world"}},
		}

		count, err := client.Send(ctx, msgs...)
		require.NoError(t, err)
		require.Equal(t, 3, count)

		// workaround for https://github.com/mocktools/go-smtp-mock/issues/181
		time.Sleep(1 * time.Millisecond)
		messages := srv.MessagesAndPurge()
		require.Len(t, messages, 3)

		for i, sentMsg := range messages {
			rcpts := sentMsg.RcpttoRequestResponse()
			require.EqualValues(t, [][]string{
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
		}
	})
}
