package notifications

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/mail"
	"net/textproto"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/notifications")

type SmtpClient struct {
	cfgProvider  configprovider.ConfigProvider
	instanceName string
}

func ProvideSmtpService(cfg *setting.Cfg, cfgProvider configprovider.ConfigProvider) (Mailer, error) {
	return NewSmtpClient(cfg, cfgProvider)
}

func NewSmtpClient(cfg *setting.Cfg, cfgProvider configprovider.ConfigProvider) (*SmtpClient, error) {
	client := &SmtpClient{
		cfgProvider:  cfgProvider,
		instanceName: cfg.InstanceName,
	}

	return client, nil
}

// readLiveSmtpSettings resolves the SMTP settings on every call, so remote
// changes apply without a restart.
func readLiveSmtpSettings(ctx context.Context, cfgProvider configprovider.ConfigProvider, instanceName string) (setting.SmtpSettings, error) {
	iniFile, err := cfgProvider.GetSections(ctx, "smtp", "smtp.static_headers", "emails")
	if err != nil {
		return setting.SmtpSettings{}, err
	}
	return setting.ReadSmtpSettings(iniFile, instanceName)
}

func (sc *SmtpClient) Send(ctx context.Context, messages ...*Message) (int, error) {
	ctx, span := tracer.Start(ctx, "notifications.SmtpClient.Send",
		trace.WithAttributes(attribute.Int("messages", len(messages))),
	)
	defer span.End()

	sentEmailsCount := 0

	smtp, err := readLiveSmtpSettings(ctx, sc.cfgProvider, sc.instanceName)
	if err != nil {
		countUndelivered(len(messages))
		return sentEmailsCount, err
	}
	// Messages queued before SMTP was disabled remotely must not go out.
	if !smtp.Enabled {
		countUndelivered(len(messages))
		return sentEmailsCount, ErrSmtpNotEnabled
	}

	dialer, err := sc.createDialer(smtp)
	if err != nil {
		countUndelivered(len(messages))
		return sentEmailsCount, err
	}

	var errs []error

	for _, msg := range messages {
		err := sc.sendMessage(ctx, dialer, smtp, msg)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		sentEmailsCount++
	}

	return sentEmailsCount, errors.Join(errs...)
}

func countUndelivered(count int) {
	emailsSentTotal.Add(float64(count))
	emailsSentFailed.Add(float64(count))
}

func (sc *SmtpClient) sendMessage(ctx context.Context, dialer *gomail.Dialer, smtp setting.SmtpSettings, msg *Message) error {
	ctx, span := tracer.Start(ctx, "notifications.SmtpClient.sendMessage", trace.WithAttributes(
		attribute.String("smtp.sender", msg.From),
		attribute.StringSlice("smtp.recipients", msg.To),
	))
	defer span.End()

	m := sc.buildEmail(ctx, smtp, msg)

	err := dialer.DialAndSend(m)
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
func (sc *SmtpClient) buildEmail(ctx context.Context, smtp setting.SmtpSettings, msg *Message) *gomail.Message {
	m := gomail.NewMessage()
	// add all static headers to the email message
	for h, val := range smtp.StaticHeaders {
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

	if smtp.EnableTracing {
		otel.GetTextMapPropagator().Inject(ctx, gomailHeaderCarrier{m})
	}

	sc.setFiles(m, msg)
	for _, replyTo := range msg.ReplyTo {
		m.SetAddressHeader("Reply-To", replyTo, "")
	}
	// loop over the message's content types in reverse order as they are ordered in according to descending
	// preference while the alternatives should be ordered according to ascending preference
	for i, v := range slices.Backward(msg.ContentTypes) {
		if i == len(msg.ContentTypes)-1 {
			m.SetBody(v, msg.Body[v])
		} else {
			m.AddAlternative(v, msg.Body[v])
		}
	}

	return m
}

// setFiles attaches files in various forms.
func (sc *SmtpClient) setFiles(
	m *gomail.Message,
	msg *Message,
) {
	for _, file := range msg.EmbeddedFiles {
		m.Embed(file)
	}

	for _, file := range msg.EmbeddedContents {
		m.Embed(file.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			_, err := writer.Write(file.Content)
			return err
		}))
	}

	for _, file := range msg.AttachedFiles {
		m.Attach(file.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			_, err := writer.Write(file.Content)
			return err
		}))
	}
}

func (sc *SmtpClient) createDialer(smtp setting.SmtpSettings) (*gomail.Dialer, error) {
	host, port, err := net.SplitHostPort(smtp.Host)
	if err != nil {
		return nil, err
	}
	iPort, err := strconv.Atoi(port)
	if err != nil {
		return nil, err
	}

	tlsconfig := &tls.Config{
		InsecureSkipVerify: smtp.SkipVerify,
		ServerName:         host,
	}

	if smtp.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(smtp.CertFile, smtp.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("could not load cert or key file: %w", err)
		}
		tlsconfig.Certificates = []tls.Certificate{cert}
	}

	d := gomail.NewDialer(host, iPort, smtp.User, smtp.Password)
	d.TLSConfig = tlsconfig
	d.StartTLSPolicy = getStartTLSPolicy(smtp.StartTLSPolicy)
	d.LocalName = smtp.EhloIdentity

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
