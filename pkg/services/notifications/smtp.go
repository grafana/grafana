package notifications

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/mail"
	"net/textproto"
	"runtime/debug"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/notifications")

type SmtpClient struct {
	cfg setting.SmtpSettings
}

func ProvideSmtpService(cfg *setting.Cfg) (Mailer, error) {
	return NewSmtpClient(cfg.Smtp)
}

func NewSmtpClient(cfg setting.SmtpSettings) (*SmtpClient, error) {
	client := &SmtpClient{
		cfg: cfg,
	}

	return client, nil
}

func (sc *SmtpClient) Send(ctx context.Context, messages ...*Message) (int, error) {
	ctx, span := tracer.Start(ctx, "notifications.SmtpClient.Send",
		trace.WithAttributes(attribute.Int("messages", len(messages))),
	)
	defer span.End()

	sentEmailsCount := 0

	dialer, err := sc.createDialer()
	if err != nil {
		return sentEmailsCount, err
	}

	for _, msg := range messages {
		err := sc.sendMessage(ctx, dialer, msg)
		if err != nil {
			return sentEmailsCount, err
		}

		sentEmailsCount++
	}

	return sentEmailsCount, nil
}

func (sc *SmtpClient) sendMessage(ctx context.Context, dialer *gomail.Dialer, msg *Message) (err error) {
	ctx, span := tracer.Start(ctx, "notifications.SmtpClient.sendMessage", trace.WithAttributes(
		attribute.String("smtp.sender", msg.From),
		attribute.StringSlice("smtp.recipients", msg.To),
	))
	defer span.End()

	// mail.v2 can panic on some attachment encodings (nil base64LineWriter.w).
	// Recover so one bad email cannot take down the Grafana process.
	defer func() {
		if r := recover(); r != nil {
			// Match the DialAndSend path: count the attempt, then the failure.
			emailsSentTotal.Inc()
			emailsSentFailed.Inc()
			err = tracing.Errorf(span, "panic while sending email: %v\n%s", r, debug.Stack())
		}
	}()

	m := sc.buildEmail(ctx, msg)

	err = dialer.DialAndSend(m)
	emailsSentTotal.Inc()
	if err != nil {
		// As gomail does not returned typed errors we have to parse the error
		// to catch invalid error when the address is invalid.
		// https://github.com/go-gomail/gomail/blob/81ebce5c23dfd25c6c67194b37d3dd3f338c98b1/send.go#L113
		if !strings.HasPrefix(err.Error(), "gomail: invalid address") {
			emailsSentFailed.Inc()
		}

		return tracing.Errorf(span, "failed to send email: %w", err)
	}

	return nil
}

// buildEmail converts the Message DTO to a gomail message.
func (sc *SmtpClient) buildEmail(ctx context.Context, msg *Message) *gomail.Message {
	m := gomail.NewMessage()
	// add all static headers to the email message
	for h, val := range sc.cfg.StaticHeaders {
		m.SetHeader(h, val)
	}
	m.SetHeader("From", msg.From)
	m.SetHeader("To", msg.To...)
	m.SetHeader("Subject", msg.Subject)

	from, err := mail.ParseAddress(msg.From)
	if err == nil {
		at := strings.LastIndex(from.Address, "@")
		if at >= 0 {
			domain := from.Address[at+1:]
			m.SetHeader("Message-ID", fmt.Sprintf("<%s@%s>", uuid.NewString(), domain))
		}
	}

	if sc.cfg.EnableTracing {
		otel.GetTextMapPropagator().Inject(ctx, gomailHeaderCarrier{m})
	}

	for _, replyTo := range msg.ReplyTo {
		m.SetAddressHeader("Reply-To", replyTo, "")
	}
	// Body parts first so multipart structure is established before attachments.
	// Content types are stored most-preferred first; alternatives must be
	// least-preferred first for MIME.
	for i := len(sc.cfg.ContentTypes) - 1; i >= 0; i-- {
		if i == len(sc.cfg.ContentTypes)-1 {
			m.SetBody(sc.cfg.ContentTypes[i], msg.Body[sc.cfg.ContentTypes[i]])
		} else {
			m.AddAlternative(sc.cfg.ContentTypes[i], msg.Body[sc.cfg.ContentTypes[i]])
		}
	}
	sc.setFiles(m, msg)

	return m
}

// setFiles attaches files in various forms.
func (sc *SmtpClient) setFiles(
	m *gomail.Message,
	msg *Message,
) {
	for _, file := range msg.EmbeddedFiles {
		if file == "" {
			continue
		}
		m.Embed(file)
	}

	for _, file := range msg.EmbeddedContents {
		if file.Name == "" || len(file.Content) == 0 {
			continue
		}
		content := file.Content
		name := file.Name
		m.Embed(name, gomail.SetCopyFunc(copyFileContent(content)))
	}

	for _, file := range msg.AttachedFiles {
		if file == nil || file.Name == "" || len(file.Content) == 0 {
			continue
		}
		content := file.Content
		name := file.Name
		m.Attach(name, gomail.SetCopyFunc(copyFileContent(content)))
	}
}

// copyFileContent returns a gomail copy function that streams content safely.
// A nil writer must not panic (mail.v2 has historically done so on the base64 path).
func copyFileContent(content []byte) func(io.Writer) error {
	return func(w io.Writer) error {
		if w == nil {
			return fmt.Errorf("mail attachment writer is nil")
		}
		_, err := io.Copy(w, bytes.NewReader(content))
		return err
	}
}

func (sc *SmtpClient) createDialer() (*gomail.Dialer, error) {
	host, port, err := net.SplitHostPort(sc.cfg.Host)
	if err != nil {
		return nil, err
	}
	iPort, err := strconv.Atoi(port)
	if err != nil {
		return nil, err
	}

	tlsconfig := &tls.Config{
		InsecureSkipVerify: sc.cfg.SkipVerify,
		ServerName:         host,
	}

	if sc.cfg.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(sc.cfg.CertFile, sc.cfg.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("could not load cert or key file: %w", err)
		}
		tlsconfig.Certificates = []tls.Certificate{cert}
	}

	d := gomail.NewDialer(host, iPort, sc.cfg.User, sc.cfg.Password)
	d.TLSConfig = tlsconfig
	d.StartTLSPolicy = getStartTLSPolicy(sc.cfg.StartTLSPolicy)
	d.LocalName = sc.cfg.EhloIdentity

	return d, nil
}

func getStartTLSPolicy(policy string) gomail.StartTLSPolicy {
	switch policy {
	case "NoStartTLS":
		return -1
	case "MandatoryStartTLS":
		return 1
	default:
		return 0
	}
}

type gomailHeaderCarrier struct {
	*gomail.Message
}

var _ propagation.TextMapCarrier = (*gomailHeaderCarrier)(nil)

func (c gomailHeaderCarrier) Get(key string) string {
	if hdr := c.GetHeader(key); len(hdr) > 0 {
		return hdr[0]
	}

	return ""
}

func (c gomailHeaderCarrier) Set(key string, value string) {
	c.SetHeader(key, value)
}

func (c gomailHeaderCarrier) Keys() []string {
	// there's no way to get all the header keys directly from a gomail.Message,
	// but we can encode the whole message and re-parse. This is not ideal, but
	// this function shouldn't be used in the hot path.
	buf := bytes.Buffer{}
	_, _ = c.WriteTo(&buf)
	hdr, _ := textproto.NewReader(bufio.NewReader(&buf)).ReadMIMEHeader()
	keys := make([]string, 0, len(hdr))
	for k := range hdr {
		keys = append(keys, k)
	}

	return keys
}
