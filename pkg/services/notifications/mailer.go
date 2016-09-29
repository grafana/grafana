// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package notifications

import (
	"bytes"
	"crypto/tls"
	"errors"
	"fmt"
	"html/template"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

var mailQueue chan *Message

func initMailQueue() {
	mailQueue = make(chan *Message, 10)
	go processMailQueue()
}

func processMailQueue() {
	for {
		select {
		case msg := <-mailQueue:
			num, err := buildAndSend(msg)
			tos := strings.Join(msg.To, "; ")
			info := ""
			if err != nil {
				if len(msg.Info) > 0 {
					info = ", info: " + msg.Info
				}
				log.Error(4, fmt.Sprintf("Async sent email %d succeed, not send emails: %s%s err: %s", num, tos, info, err))
			} else {
				log.Trace(fmt.Sprintf("Async sent email %d succeed, sent emails: %s%s", num, tos, info))
			}
		}
	}
}

var addToMailQueue = func(msg *Message) {
	mailQueue <- msg
}

func sendToSmtpServer(recipients []string, msgContent []byte) error {
	host, port, err := net.SplitHostPort(setting.Smtp.Host)
	if err != nil {
		return err
	}

	tlsconfig := &tls.Config{
		InsecureSkipVerify: setting.Smtp.SkipVerify,
		ServerName:         host,
	}

	if setting.Smtp.CertFile != "" {
		cert, err := tls.LoadX509KeyPair(setting.Smtp.CertFile, setting.Smtp.KeyFile)
		if err != nil {
			return err
		}
		tlsconfig.Certificates = []tls.Certificate{cert}
	}

	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), time.Second*10)
	if err != nil {
		return err
	}
	defer conn.Close()

	isSecureConn := false
	// Start TLS directly if the port ends with 465 (SMTPS protocol)
	if strings.HasSuffix(port, "465") {
		conn = tls.Client(conn, tlsconfig)
		isSecureConn = true
	}

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}

	hostname, err := os.Hostname()
	if err != nil {
		return err
	}

	if err = client.Hello(hostname); err != nil {
		return err
	}

	// If not using SMTPS, alway use STARTTLS if available
	hasStartTLS, _ := client.Extension("STARTTLS")
	if !isSecureConn && hasStartTLS {
		if err = client.StartTLS(tlsconfig); err != nil {
			return err
		}
	}

	canAuth, options := client.Extension("AUTH")

	if canAuth && len(setting.Smtp.User) > 0 {
		var auth smtp.Auth

		if strings.Contains(options, "CRAM-MD5") {
			auth = smtp.CRAMMD5Auth(setting.Smtp.User, setting.Smtp.Password)
		} else if strings.Contains(options, "PLAIN") {
			auth = smtp.PlainAuth("", setting.Smtp.User, setting.Smtp.Password, host)
		}

		if auth != nil {
			if err = client.Auth(auth); err != nil {
				return err
			}
		}
	}

	if fromAddress, err := mail.ParseAddress(setting.Smtp.FromAddress); err != nil {
		return err
	} else {
		if err = client.Mail(fromAddress.Address); err != nil {
			return err
		}
	}

	for _, rec := range recipients {
		if err = client.Rcpt(rec); err != nil {
			return err
		}
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err = w.Write([]byte(msgContent)); err != nil {
		return err
	}

	if err = w.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func buildAndSend(msg *Message) (int, error) {
	log.Trace("Sending mails to: %s", strings.Join(msg.To, "; "))

	// get message body
	content := msg.Content()

	if len(msg.To) == 0 {
		return 0, fmt.Errorf("empty receive emails")
	} else if len(msg.Body) == 0 {
		return 0, fmt.Errorf("empty email body")
	}

	if msg.Massive {
		// send mail to multiple emails one by one
		num := 0
		for _, to := range msg.To {
			body := []byte("To: " + to + "\r\n" + content)
			err := sendToSmtpServer([]string{to}, body)
			if err != nil {
				return num, err
			}
			num++
		}
		return num, nil
	} else {
		body := []byte("To: " + strings.Join(msg.To, ";") + "\r\n" + content)

		// send to multiple emails in one message
		err := sendToSmtpServer(msg.To, body)
		if err != nil {
			return 0, err
		} else {
			return 1, nil
		}
	}
}

func buildEmailMessage(cmd *m.SendEmailCommand) (*Message, error) {
	if !setting.Smtp.Enabled {
		return nil, errors.New("Grafana mailing/smtp options not configured, contact your Grafana admin")
	}

	var buffer bytes.Buffer
	var err error
	var subjectText interface{}

	data := cmd.Data
	if data == nil {
		data = make(map[string]interface{}, 10)
	}

	setDefaultTemplateData(data, nil)
	err = mailTemplates.ExecuteTemplate(&buffer, cmd.Template, data)
	if err != nil {
		return nil, err
	}

	subjectData := data["Subject"].(map[string]interface{})
	subjectText, hasSubject := subjectData["value"]

	if !hasSubject {
		return nil, errors.New(fmt.Sprintf("Missing subject in Template %s", cmd.Template))
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

	return &Message{
		To:      cmd.To,
		From:    setting.Smtp.FromAddress,
		Subject: subjectBuffer.String(),
		Body:    buffer.String(),
	}, nil
}
