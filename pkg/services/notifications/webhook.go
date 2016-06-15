package notifications

import (
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/log"
)

type Webhook struct {
	Url          string
	AuthUser     string
	AuthPassword string
	Body         string
	Method       string
}

var webhookQueue chan *Webhook
var webhookLog log.Logger

func initWebhookQueue() {
	webhookLog = log.New("notifications.webhook")
	webhookQueue = make(chan *Webhook, 10)
	go processWebhookQueue()
}

func processWebhookQueue() {
	for {
		select {
		case webhook := <-webhookQueue:
			err := sendWebRequest(webhook)

			if err != nil {
				webhookLog.Error("Failed to send webrequest ")
			}
		}
	}
}

func sendWebRequest(webhook *Webhook) error {
	webhookLog.Error("Sending stuff! ", "url", webhook.Url)

	client := http.Client{Timeout: time.Duration(3 * time.Second)}

	request, err := http.NewRequest(webhook.Method, webhook.Url, nil /*io.reader*/)

	if err != nil {
		return err
	}

	resp, err := client.Do(request)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

var addToWebhookQueue = func(msg *Webhook) {
	webhookQueue <- msg
}
