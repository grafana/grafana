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
	"strconv"
	"strings"

	gomail "gopkg.in/mail.v2"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func (ns *NotificationService) send(msg *Message) (int, error) {
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

func (ns *NotificationService) dialAndSend(messages ...*Message) (num int, err error) {
	dialer, err := ns.createDialer()
	if err != nil {
		return
	}

	for _, msg := range messages {
		m := gomail.NewMessage()
		m.SetHeader("From", msg.From)
		m.SetHeader("To", msg.To...)
		m.SetHeader("Subject", msg.Subject)

		ns.setFiles(m, msg)

		for _, replyTo := range msg.ReplyTo {
			m.SetAddressHeader("Reply-To", replyTo, "")
		}

		m.SetBody("text/html", msg.Body)

		if e := dialer.DialAndSend(m); e != nil {
			err = errutil.Wrapf(e, "Failed to send notification to email addresses: %s", strings.Join(msg.To, ";"))
			continue
		}

		num++
	}

	return
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
			return nil, fmt.Errorf("Could not load cert or key file. error: %v", err)
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

	var buffer bytes.Buffer
	var err error

	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)
	err = mailTemplates.ExecuteTemplate(&buffer, cmd.Template, data)
	if err != nil {
		return nil, err
	}

	subject := cmd.Subject
	if cmd.Subject == "" {
		var subjectText interface{}
		subjectData := data["Subject"].(map[string]interface{})
		subjectText, hasSubject := subjectData["value"]

		if !hasSubject {
			return nil, fmt.Errorf("Missing subject in Template %s", cmd.Template)
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

	return &Message{
		To:            cmd.To,
		SingleEmail:   cmd.SingleEmail,
		From:          fmt.Sprintf("%s <%s>", ns.Cfg.Smtp.FromName, ns.Cfg.Smtp.FromAddress),
		Subject:       subject,
		Body:          buffer.String(),
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
