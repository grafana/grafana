// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package notifications

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"io"
	"net"
	"net/mail"
	"strconv"
	"strings"

	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	emailsSentTotal  prometheus.Counter
	emailsSentFailed prometheus.Counter
)

func init() {
	emailsSentTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name:      "emails_sent_total",
		Help:      "Number of emails sent by Grafana",
		Namespace: "grafana",
	})

	emailsSentFailed = promauto.NewCounter(prometheus.CounterOpts{
		Name:      "emails_sent_failed",
		Help:      "Number of emails Grafana failed to send",
		Namespace: "grafana",
	})
}

func (ns *NotificationService) Send(msg *Message) (int, error) {
	messages := []*Message{}

	if msg.SingleEmail {
		messages = append(messages, msg)
	} else {
		for _, address := range msg.To {
			copy := *msg
			copy.To = []string{address}
			messages = append(messages, &copy)
		}
	}

	return ns.dialAndSend(messages...)
}

func (ns *NotificationService) dialAndSend(messages ...*Message) (int, error) {
	sentEmailsCount := 0
	dialer, err := ns.createDialer()
	if err != nil {
		return sentEmailsCount, err
	}

	for _, msg := range messages {
		m := ns.buildEmail(msg)

		innerError := dialer.DialAndSend(m)
		emailsSentTotal.Inc()
		if innerError != nil {
			// As gomail does not returned typed errors we have to parse the error
			// to catch invalid error when the address is invalid.
			// https://github.com/go-gomail/gomail/blob/81ebce5c23dfd25c6c67194b37d3dd3f338c98b1/send.go#L113
			if !strings.HasPrefix(innerError.Error(), "gomail: invalid address") {
				emailsSentFailed.Inc()
			}

			err = errutil.Wrapf(innerError, "Failed to send notification to email addresses: %s", strings.Join(msg.To, ";"))
			continue
		}

		sentEmailsCount++
	}

	return sentEmailsCount, err
}

func (ns *NotificationService) buildEmail(msg *Message) *gomail.Message {
	m := gomail.NewMessage()
	m.SetHeader("From", msg.From)
	m.SetHeader("To", msg.To...)
	m.SetHeader("Subject", msg.Subject)
	ns.setFiles(m, msg)
	for _, replyTo := range msg.ReplyTo {
		m.SetAddressHeader("Reply-To", replyTo, "")
	}
	// loop over content types from settings in reverse order as they are ordered in according to descending
	// preference while the alternatives should be ordered according to ascending preference
	for i := len(ns.Cfg.Smtp.ContentTypes) - 1; i >= 0; i-- {
		if i == len(ns.Cfg.Smtp.ContentTypes)-1 {
			m.SetBody(ns.Cfg.Smtp.ContentTypes[i], msg.Body[ns.Cfg.Smtp.ContentTypes[i]])
		} else {
			m.AddAlternative(ns.Cfg.Smtp.ContentTypes[i], msg.Body[ns.Cfg.Smtp.ContentTypes[i]])
		}
	}

	return m
}

// setFiles attaches files in various forms
func (ns *NotificationService) setFiles(
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

func (ns *NotificationService) createDialer() (*gomail.Dialer, error) {
	host, port, err := net.SplitHostPort(ns.Cfg.Smtp.Host)
	if err != nil {
		return nil, err
	}
	iPort, err := strconv.Atoi(port)
	if err != nil {
		return nil, err
	}

	tlsconfig := &tls.Config{
		InsecureSkipVerify: ns.Cfg.Smtp.SkipVerify,
		ServerName:         host,
	}

	if ns.Cfg.Smtp.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(ns.Cfg.Smtp.CertFile, ns.Cfg.Smtp.KeyFile)
		if err != nil {
			return nil, fmt.Errorf("could not load cert or key file: %w", err)
		}
		tlsconfig.Certificates = []tls.Certificate{cert}
	}

	d := gomail.NewDialer(host, iPort, ns.Cfg.Smtp.User, ns.Cfg.Smtp.Password)
	d.TLSConfig = tlsconfig
	d.StartTLSPolicy = getStartTLSPolicy(ns.Cfg.Smtp.StartTLSPolicy)

	if ns.Cfg.Smtp.EhloIdentity != "" {
		d.LocalName = ns.Cfg.Smtp.EhloIdentity
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

func (ns *NotificationService) buildEmailMessage(cmd *models.SendEmailCommand) (*Message, error) {
	if !ns.Cfg.Smtp.Enabled {
		return nil, models.ErrSmtpNotEnabled
	}

	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)

	body := make(map[string]string)
	for _, contentType := range ns.Cfg.Smtp.ContentTypes {
		fileExtension, err := getFileExtensionByContentType(contentType)
		if err != nil {
			return nil, err
		}
		var buffer bytes.Buffer
		err = mailTemplates.ExecuteTemplate(&buffer, cmd.Template+fileExtension, data)
		if err != nil {
			return nil, err
		}

		body[contentType] = buffer.String()
	}

	subject := cmd.Subject
	if cmd.Subject == "" {
		var subjectText interface{}
		subjectData := data["Subject"].(map[string]interface{})
		subjectText, hasSubject := subjectData["value"]

		if !hasSubject {
			return nil, fmt.Errorf("missing subject in template %s", cmd.Template)
		}

		subjectTmpl, err := template.New("subject").Parse(subjectText.(string))
		if err != nil {
			return nil, err
		}

		var subjectBuffer bytes.Buffer
		err = subjectTmpl.ExecuteTemplate(&subjectBuffer, "subject", data)
		if err != nil {
			return nil, err
		}

		subject = subjectBuffer.String()
	}

	addr := mail.Address{Name: ns.Cfg.Smtp.FromName, Address: ns.Cfg.Smtp.FromAddress}
	return &Message{
		To:            cmd.To,
		SingleEmail:   cmd.SingleEmail,
		From:          addr.String(),
		Subject:       subject,
		Body:          body,
		EmbeddedFiles: cmd.EmbeddedFiles,
		AttachedFiles: buildAttachedFiles(cmd.AttachedFiles),
		ReplyTo:       cmd.ReplyTo,
	}, nil
}

// buildAttachedFiles build attached files
func buildAttachedFiles(
	attached []*models.SendEmailAttachFile,
) []*AttachedFile {
	result := make([]*AttachedFile, 0)

	for _, file := range attached {
		result = append(result, &AttachedFile{
			Name:    file.Name,
			Content: file.Content,
		})
	}

	return result
}

func getFileExtensionByContentType(contentType string) (string, error) {
	switch contentType {
	case "text/html":
		return ".html", nil
	case "text/plain":
		return ".txt", nil
	default:
		return "", fmt.Errorf("unrecognized content type %q", contentType)
	}
}
