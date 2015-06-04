// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package mailer

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/notifications"
	"github.com/grafana/grafana/pkg/setting"
)

var mailQueue chan *notifications.SendEmailCommand

func Init() {
	bus.AddHandler("email", handleEmailCommand)

	mailQueue = make(chan *notifications.SendEmailCommand, 10)

	setting.Smtp = setting.SmtpSettings{
		Host:        "smtp.gmail.com:587",
		User:        "torkel.odegaard@gmail.com",
		Password:    "peslpwstnnloiksq",
		FromAddress: "grafana@grafana.org",
	}

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

func encodeRFC2047(text string) string {
	// use mail's rfc2047 to encode any string
	addr := mail.Address{Address: text}
	return strings.Trim(addr.String(), " <>")
}

func handleEmailCommand(cmd *notifications.SendEmailCommand) error {
	log.Info("Sending on queue")
	mailQueue <- cmd
	return nil
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

	conn, err := net.Dial("tcp", net.JoinHostPort(host, port))
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
	// smtpServer := "smtp.gmail.com"
	// auth := smtp.PlainAuth(
	// 	"",
	// 	"torkel.odegaard@gmail.com",
	// 	"peslpwstnnloiksq",
	// 	smtpServer,
	// )
	//
	// from := mail.Address{Name: "test", Address: "torkel@test.com"}
	// to := mail.Address{Name: "Torkel Ödegaard", Address: "torkel@raintank.io"}
	// title := "Message from Grafana"
	//
	// body := "Testing email sending"
	//
	// header := make(map[string]string)
	// header["From"] = from.String()
	// header["To"] = to.String()
	// header["Subject"] = encodeRFC2047(title)
	// header["MIME-Version"] = "1.0"
	// header["Content-Type"] = "text/plain; charset=\"utf-8\""
	// header["Content-Transfer-Encoding"] = "base64"
	//
	// message := ""
	// for k, v := range header {
	// 	message += fmt.Sprintf("%s: %s\r\n", k, v)
	// }
	// message += "\r\n" + base64.StdEncoding.EncodeToString([]byte(body))
	//
	// // Connect to the server, authenticate, set the sender and recipient,
	// // and send the email all in one step.
	// err := smtp.SendMail(
	// 	smtpServer+":587",
	// 	auth,
	// 	from.Address,
	// 	[]string{to.Address},
	// 	[]byte(message),
	// )
	// if err != nil {
	// 	log.Info("Failed to send email: %v", err)
	// }
	// kkkk
}

func buildAndSend(msg *m.SendEmailCommand) (int, error) {
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
