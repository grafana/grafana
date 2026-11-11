package notifications

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/netip"
	"net/smtp"
	"net/textproto"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	smtpmock "github.com/mocktools/go-smtp-mock/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	gomail "gopkg.in/mail.v2"

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

// stubResolver replaces the DNS lookup of an SmtpClient and records the hosts it was asked for.
type stubResolver struct {
	addrs map[string][]netip.Addr
	calls []string
}

func (resolver *stubResolver) lookup(_ context.Context, host string) ([]netip.Addr, error) {
	resolver.calls = append(resolver.calls, host)
	addrs, ok := resolver.addrs[host]
	if !ok {
		return nil, fmt.Errorf("no such host %q", host)
	}
	return addrs, nil
}

func newStubResolver(addrs map[string][]string) *stubResolver {
	resolver := &stubResolver{addrs: map[string][]netip.Addr{}}
	for host, list := range addrs {
		for _, addr := range list {
			resolver.addrs[host] = append(resolver.addrs[host], netip.MustParseAddr(addr))
		}
	}
	return resolver
}

// newHostListClient returns a client for smtpHost with the given [security.smtp]
// keys and a stub resolver.
func newHostListClient(t *testing.T, smtpHost string, securityKeys map[string]string, resolver *stubResolver) *SmtpClient {
	t.Helper()
	cfg := smtpRawCfg(t, map[string]string{"enabled": "true", "host": smtpHost})
	setRawKeys(t, cfg, "security.smtp", securityKeys)
	client := newTestSmtpClient(t, cfg)
	client.lookupIP = resolver.lookup
	return client
}

func liveSmtpSettings(t *testing.T, client *SmtpClient) setting.SmtpSettings {
	t.Helper()
	smtp, err := readLiveSmtpSettings(context.Background(), client.cfgProvider, client.instanceName)
	require.NoError(t, err)
	return smtp
}

func newDialersFor(t *testing.T, client *SmtpClient) ([]*gomail.Dialer, error) {
	t.Helper()
	return client.createDialers(context.Background(), liveSmtpSettings(t, client))
}

func dialerHosts(dialers []*gomail.Dialer) []string {
	hosts := make([]string, 0, len(dialers))
	for _, dialer := range dialers {
		hosts = append(hosts, dialer.Host)
	}
	return hosts
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

func TestSmtpHostLists(t *testing.T) {
	ctx := context.Background()
	newMessage := func() *Message {
		return &Message{From: "from@example.com", To: []string{"rcpt@example.com"},
			Subject: "subject", ContentTypes: []string{"text/plain"}, Body: map[string]string{"text/plain": "hello world"}}
	}

	rejectedCases := []struct {
		name         string
		host         string
		securityKeys map[string]string
		resolved     map[string][]string
		wantHostname string
	}{
		{
			name:         "denied resolved address",
			host:         "mail.example.com:25",
			securityKeys: map[string]string{"host_deny_list": "10.0.0.0/8"},
			resolved:     map[string][]string{"mail.example.com": {"10.1.2.3"}},
			wantHostname: "mail.example.com",
		},
		{
			name:         "one denied address among several",
			host:         "mail.example.com:25",
			securityKeys: map[string]string{"host_deny_list": "10.0.0.0/8"},
			resolved:     map[string][]string{"mail.example.com": {"8.8.8.8", "10.1.2.3"}},
			wantHostname: "mail.example.com",
		},
		{
			name:         "denied hostname in a different case with trailing dot",
			host:         "BAD.example.:25",
			securityKeys: map[string]string{"host_deny_list": "bad.example"},
			resolved:     map[string][]string{"bad.example": {"8.8.8.8"}},
			wantHostname: "BAD.example.",
		},
		{
			name:         "IPv4-mapped IPv6 literal in a denied IPv4 range",
			host:         "[::ffff:10.0.0.1]:25",
			securityKeys: map[string]string{"host_deny_list": "10.0.0.0/8"},
			wantHostname: "::ffff:10.0.0.1",
		},
		{
			name:         "allowed address does not cover another denied address",
			host:         "mail.example.com:25",
			securityKeys: map[string]string{"host_deny_list": "10.0.0.0/8", "host_allow_list": "10.1.2.3"},
			resolved:     map[string][]string{"mail.example.com": {"10.1.2.3", "10.9.9.9"}},
			wantHostname: "mail.example.com",
		},
	}
	for _, tc := range rejectedCases {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			client := newHostListClient(t, tc.host, tc.securityKeys, newStubResolver(tc.resolved))

			count, err := client.Send(ctx, newMessage())

			assert.Equal(t, 0, count)
			require.EqualError(t, err, fmt.Sprintf("smtp host %q is not allowed", tc.wantHostname))
			for _, addrs := range tc.resolved {
				for _, addr := range addrs {
					assert.NotContains(t, err.Error(), addr)
				}
			}
		})
	}

	t.Run("dials the checked address and keeps the hostname for TLS", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"8.8.8.8", "9.9.9.9"}})
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		require.NotEmpty(t, dialers)
		assert.Equal(t, "8.8.8.8", dialers[0].Host)
		assert.Equal(t, "mail.example.com", dialers[0].TLSConfig.ServerName)
		assert.Equal(t, 25, dialers[0].Port)
	})

	t.Run("resolveDialHosts returns every checked address in resolver order", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"8.8.8.8", "9.9.9.9"}})
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, resolver)

		hosts, err := client.resolveDialHosts(ctx, "mail.example.com", liveSmtpSettings(t, client))

		require.NoError(t, err)
		assert.Equal(t, []string{"8.8.8.8", "9.9.9.9"}, hosts)
	})

	t.Run("createDialers returns one dialer per address with its own host", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"8.8.8.8", "fd00::1"}})
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		assert.Equal(t, []string{"8.8.8.8", "[fd00::1]"}, dialerHosts(dialers))
		assert.NotSame(t, dialers[0], dialers[1])
		for _, dialer := range dialers {
			assert.Equal(t, "mail.example.com", dialer.TLSConfig.ServerName)
		}
	})

	t.Run("allowed hostname skips the lookup", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"smtpproxy": {"10.1.2.3"}})
		client := newHostListClient(t, "smtpproxy:25", map[string]string{
			"host_deny_list":  "10.0.0.0/8",
			"host_allow_list": "smtpproxy",
		}, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		assert.Equal(t, []string{"smtpproxy"}, dialerHosts(dialers))
		assert.Empty(t, resolver.calls)
	})

	t.Run("allowed address is exempt from the deny list", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"10.1.2.3"}})
		client := newHostListClient(t, "mail.example.com:25", map[string]string{
			"host_deny_list":  "10.0.0.0/8",
			"host_allow_list": "10.1.2.3",
		}, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		assert.Equal(t, []string{"10.1.2.3"}, dialerHosts(dialers))
	})

	t.Run("lookup failure rejects the send", func(t *testing.T) {
		client := newHostListClient(t, "unknown.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, newStubResolver(nil))

		_, err := newDialersFor(t, client)

		require.EqualError(t, err, `could not resolve smtp host "unknown.example.com"`)
	})

	t.Run("lookup failure does not expose the DNS server address", func(t *testing.T) {
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, newStubResolver(nil))
		client.lookupIP = func(context.Context, string) ([]netip.Addr, error) {
			return nil, errors.New("lookup mail.example.com on 10.0.0.2:53: no such host")
		}

		_, err := newDialersFor(t, client)

		require.EqualError(t, err, `could not resolve smtp host "mail.example.com"`)
		assert.NotContains(t, err.Error(), "10.0.0.2")
	})

	t.Run("brackets an IPv6 address resolved for the dialer", func(t *testing.T) {
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"fd00::1"}})
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/8"}, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		require.Len(t, dialers, 1)
		assert.Equal(t, "[fd00::1]", dialers[0].Host)
		assert.Equal(t, "mail.example.com", dialers[0].TLSConfig.ServerName)
	})

	t.Run("brackets an IPv6 literal host when the lists are empty", func(t *testing.T) {
		client := newHostListClient(t, "[::1]:25", nil, newStubResolver(nil))

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		require.Len(t, dialers, 1)
		assert.Equal(t, "[::1]", dialers[0].Host)
		assert.Equal(t, "::1", dialers[0].TLSConfig.ServerName)
	})

	t.Run("brackets an allowed IPv6 literal host", func(t *testing.T) {
		client := newHostListClient(t, "[fd00::1]:25", map[string]string{
			"host_deny_list":  "fd00::/8",
			"host_allow_list": "fd00::1",
		}, newStubResolver(nil))

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		assert.Equal(t, []string{"[fd00::1]"}, dialerHosts(dialers))
	})

	t.Run("empty lists neither resolve nor change the host", func(t *testing.T) {
		resolver := newStubResolver(nil)
		client := newHostListClient(t, "mail.example.com:25", nil, resolver)

		dialers, err := newDialersFor(t, client)

		require.NoError(t, err)
		assert.Equal(t, []string{"mail.example.com"}, dialerHosts(dialers))
		assert.Empty(t, resolver.calls)
	})

	t.Run("invalid list entry fails the send", func(t *testing.T) {
		client := newHostListClient(t, "mail.example.com:25", map[string]string{"host_deny_list": "10.0.0.0/33"}, newStubResolver(nil))

		count, err := client.Send(ctx, newMessage())

		assert.Equal(t, 0, count)
		require.ErrorContains(t, err, "host_deny_list")
	})

	t.Run("end to end", func(t *testing.T) {
		srv := smtpmock.New(smtpmock.ConfigurationAttr{HostAddress: "127.0.0.1"})
		require.NoError(t, srv.Start())
		defer func() { _ = srv.Stop() }()
		resolver := newStubResolver(map[string][]string{"mail.example.com": {"127.0.0.1"}})

		t.Run("deny list blocks the send", func(t *testing.T) {
			host := fmt.Sprintf("mail.example.com:%d", srv.PortNumber())
			client := newHostListClient(t, host, map[string]string{"host_deny_list": "127.0.0.0/8"}, resolver)

			count, err := client.Send(ctx, newMessage())

			assert.Equal(t, 0, count)
			require.EqualError(t, err, `smtp host "mail.example.com" is not allowed`)
			assert.Empty(t, srv.MessagesAndPurge())
		})

		t.Run("unrelated deny list delivers through the resolved address", func(t *testing.T) {
			host := fmt.Sprintf("mail.example.com:%d", srv.PortNumber())
			client := newHostListClient(t, host, map[string]string{"host_deny_list": "10.0.0.0/8"}, resolver)

			count, err := client.Send(ctx, newMessage())

			require.NoError(t, err)
			assert.Equal(t, 1, count)
			messages, err := srv.WaitForMessagesAndPurge(1, 5*time.Second)
			require.NoError(t, err)
			assert.Len(t, messages, 1)
		})

		t.Run("falls back to the next address when the first refuses the connection", func(t *testing.T) {
			// Nothing listens on ::1, so the first dial fails and the mock on 127.0.0.1 takes over.
			failoverResolver := newStubResolver(map[string][]string{"mail.example.com": {"::1", "127.0.0.1"}})
			host := fmt.Sprintf("mail.example.com:%d", srv.PortNumber())
			client := newHostListClient(t, host, map[string]string{"host_deny_list": "10.0.0.0/8"}, failoverResolver)

			count, err := client.Send(ctx, newMessage())

			require.NoError(t, err)
			assert.Equal(t, 1, count)
			messages, err := srv.WaitForMessagesAndPurge(1, 5*time.Second)
			require.NoError(t, err)
			assert.Len(t, messages, 1)
		})

		t.Run("hides the resolved address when every address is unreachable", func(t *testing.T) {
			unreachableResolver := newStubResolver(map[string][]string{"mail.example.com": {"::1"}})
			host := fmt.Sprintf("mail.example.com:%d", srv.PortNumber())
			client := newHostListClient(t, host, map[string]string{"host_deny_list": "10.0.0.0/8"}, unreachableResolver)

			count, err := client.Send(ctx, newMessage())

			assert.Equal(t, 0, count)
			require.EqualError(t, err, `failed to send email: could not connect to smtp host "mail.example.com"`)
			assert.NotContains(t, err.Error(), "::1")
			assert.Empty(t, srv.MessagesAndPurge())
		})

		t.Run("hides the address when an allow-listed host is unreachable", func(t *testing.T) {
			host := fmt.Sprintf("[::1]:%d", srv.PortNumber())
			client := newHostListClient(t, host, map[string]string{
				"host_deny_list":  "10.0.0.0/8",
				"host_allow_list": "::1",
			}, newStubResolver(nil))

			count, err := client.Send(ctx, newMessage())

			assert.Equal(t, 0, count)
			require.EqualError(t, err, `failed to send email: could not connect to smtp host "::1"`)
			assert.NotContains(t, err.Error(), "dial tcp")
			assert.NotContains(t, err.Error(), strconv.Itoa(srv.PortNumber()))
		})

		t.Run("returns the raw connect error when both lists are empty", func(t *testing.T) {
			host := fmt.Sprintf("[::1]:%d", srv.PortNumber())
			client := newHostListClient(t, host, nil, newStubResolver(nil))

			count, err := client.Send(ctx, newMessage())

			assert.Equal(t, 0, count)
			require.ErrorContains(t, err, "dial tcp")
			var opErr *net.OpError
			require.ErrorAs(t, err, &opErr)
		})
	})
}

func TestIsConnectError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{name: "dial op error", err: &net.OpError{Op: "dial", Err: errors.New("refused")}, want: true},
		{name: "wrapped dial op error", err: fmt.Errorf("wrapped: %w", &net.OpError{Op: "dial", Err: errors.New("refused")}), want: true},
		{name: "read op error", err: &net.OpError{Op: "read", Err: errors.New("reset")}, want: false},
		{name: "plain error", err: errors.New("535 auth failed"), want: false},
		{name: "nil", err: nil, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, isConnectError(tc.err))
		})
	}
}

func startSmtpMock(t *testing.T, config smtpmock.ConfigurationAttr) *smtpmock.Server {
	t.Helper()
	config.HostAddress = "127.0.0.1"
	srv := smtpmock.New(config)
	require.NoError(t, srv.Start())
	t.Cleanup(func() { _ = srv.Stop() })
	return srv
}

func TestDialAndSendDoesNotFallBackAfterConnect(t *testing.T) {
	const from = "from@example.com"

	cases := []struct {
		name string
		// newFirstDialer returns the dialer that connects but then fails.
		newFirstDialer func(t *testing.T) *gomail.Dialer
		wantErr        string
	}{
		{
			name:    "send error",
			wantErr: "could not send email 1: 550",
			newFirstDialer: func(t *testing.T) *gomail.Dialer {
				srv := startSmtpMock(t, smtpmock.ConfigurationAttr{
					BlacklistedMailfromEmails:   []string{from},
					MsgMailfromBlacklistedEmail: "550 sender rejected",
				})
				dialer := gomail.NewDialer("127.0.0.1", srv.PortNumber(), "", "")
				dialer.StartTLSPolicy = gomail.NoStartTLS
				return dialer
			},
		},
		{
			name:    "TLS error",
			wantErr: "first record does not look like a TLS handshake",
			newFirstDialer: func(t *testing.T) *gomail.Dialer {
				srv := startSmtpMock(t, smtpmock.ConfigurationAttr{})
				dialer := gomail.NewDialer("127.0.0.1", srv.PortNumber(), "", "")
				dialer.SSL = true
				return dialer
			},
		},
		{
			name:    "auth error",
			wantErr: "502 \"Command unrecognized",
			newFirstDialer: func(t *testing.T) *gomail.Dialer {
				srv := startSmtpMock(t, smtpmock.ConfigurationAttr{})
				dialer := gomail.NewDialer("127.0.0.1", srv.PortNumber(), "", "")
				dialer.StartTLSPolicy = gomail.NoStartTLS
				// The mock does not advertise AUTH, so gomail would skip authentication on its own.
				dialer.Auth = smtp.PlainAuth("", "user", "password", "127.0.0.1")
				return dialer
			},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			healthy := startSmtpMock(t, smtpmock.ConfigurationAttr{})
			healthyDialer := gomail.NewDialer("127.0.0.1", healthy.PortNumber(), "", "")
			healthyDialer.StartTLSPolicy = gomail.NoStartTLS
			msg := gomail.NewMessage()
			msg.SetHeader("From", from)
			msg.SetHeader("To", "rcpt@example.com")
			msg.SetBody("text/plain", "hello world")
			client := newTestSmtpClient(t, setting.NewCfg())

			err := client.dialAndSend([]*gomail.Dialer{tc.newFirstDialer(t), healthyDialer}, msg)

			require.ErrorContains(t, err, tc.wantErr)
			assert.False(t, isConnectError(err))
			assert.Empty(t, healthy.MessagesAndPurge())
		})
	}
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
