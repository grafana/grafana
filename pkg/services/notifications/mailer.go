// Copyright 2014 The Gogs Authors. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

package notifications

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"net/mail"

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

type Mailer interface {
	Send(ctx context.Context, messages ...*Message) (int, error)
}

func (ns *NotificationService) Send(ctx context.Context, msg *Message) (int, error) {
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

	return ns.mailer.Send(ctx, messages...)
}

func (ns *NotificationService) buildEmailMessage(cmd *SendEmailCommand) (*Message, error) {
	if !ns.Cfg.Smtp.Enabled {
		return nil, ErrSmtpNotEnabled
	}

	data := cmd.Data
	if data == nil {
		data = make(map[string]any, 10)
	}

	setDefaultTemplateData(ns.Cfg, data, nil)

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
		subjectData := data["Subject"].(map[string]any)
		subjectText, hasSubject := subjectData["executed_template"].(string)
		if hasSubject {
			// first check to see if the template has already been executed in a template func
			subject = subjectText
		} else {
			subjectTemplate, hasSubject := subjectData["value"]

			if !hasSubject {
				return nil, fmt.Errorf("missing subject in template %s", cmd.Template)
			}

			subjectTmpl, err := template.New("subject").Parse(subjectTemplate.(string))
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
	}

	addr := mail.Address{Name: ns.Cfg.Smtp.FromName, Address: ns.Cfg.Smtp.FromAddress}
	return &Message{
		To:               cmd.To,
		SingleEmail:      cmd.SingleEmail,
		From:             addr.String(),
		Subject:          subject,
		Body:             body,
		EmbeddedFiles:    cmd.EmbeddedFiles,
		EmbeddedContents: cmd.EmbeddedContents,
		AttachedFiles:    buildAttachedFiles(cmd.AttachedFiles),
		ReplyTo:          cmd.ReplyTo,
	}, nil
}

// buildAttachedFiles build attached files
func buildAttachedFiles(
	attached []*SendEmailAttachFile,
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
