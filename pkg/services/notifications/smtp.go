package notifications

import (
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"

	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/setting"
)

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

func (sc *SmtpClient) Send(messages ...*Message) (int, error) {
	sentEmailsCount := 0
	dialer, err := sc.createDialer()
	if err != nil {
		return sentEmailsCount, err
	}

	for _, msg := range messages {
		m := sc.buildEmail(msg)

		innerError := dialer.DialAndSend(m)
		emailsSentTotal.Inc()
		if innerError != nil {
			// As gomail does not returned typed errors we have to parse the error
			// to catch invalid error when the address is invalid.
			// https://github.com/go-gomail/gomail/blob/81ebce5c23dfd25c6c67194b37d3dd3f338c98b1/send.go#L113
			if !strings.HasPrefix(innerError.Error(), "gomail: invalid address") {
				emailsSentFailed.Inc()
			}

			err = fmt.Errorf("failed to send notification to email addresses: %s: %w", strings.Join(msg.To, ";"), innerError)
			continue
		}

		sentEmailsCount++
	}

	return sentEmailsCount, err
}

// buildEmail converts the Message DTO to a gomail message.
func (sc *SmtpClient) buildEmail(msg *Message) *gomail.Message {
	m := gomail.NewMessage()
	m.SetHeader("From", msg.From)
	m.SetHeader("To", msg.To...)
	m.SetHeader("Subject", msg.Subject)
	sc.setFiles(m, msg)
	for _, replyTo := range msg.ReplyTo {
		m.SetAddressHeader("Reply-To", replyTo, "")
	}
	// loop over content types from settings in reverse order as they are ordered in according to descending
	// preference while the alternatives should be ordered according to ascending preference
	for i := len(sc.cfg.ContentTypes) - 1; i >= 0; i-- {
		if i == len(sc.cfg.ContentTypes)-1 {
			m.SetBody(sc.cfg.ContentTypes[i], msg.Body[sc.cfg.ContentTypes[i]])
		} else {
			m.AddAlternative(sc.cfg.ContentTypes[i], msg.Body[sc.cfg.ContentTypes[i]])
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

	for _, file := range msg.AttachedFiles {
		file := file
		m.Attach(file.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			_, err := writer.Write(file.Content)
			return err
		}))
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

	if sc.cfg.EhloIdentity != "" {
		d.LocalName = sc.cfg.EhloIdentity
	} else {
		d.LocalName = setting.InstanceName
	}
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
