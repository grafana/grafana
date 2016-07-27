package notifications

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/util"
)

type Webhook struct {
	Url      string
	User     string
	Password string
	Body     string
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
				webhookLog.Error("Failed to send webrequest ", "error", err)
			}
		}
	}
}

func sendWebRequest(webhook *Webhook) error {
	webhookLog.Debug("Sending webhook", "url", webhook.Url)

	client := http.Client{
		Timeout: time.Duration(3 * time.Second),
	}

	request, err := http.NewRequest("POST", webhook.Url, bytes.NewReader([]byte(webhook.Body)))
	if webhook.User != "" && webhook.Password != "" {
		request.Header.Add("Authorization", util.GetBasicAuthHeader(webhook.User, webhook.Password))
	}

	if err != nil {
		return err
	}

	resp, err := client.Do(request)
	if err != nil {
		return err
	}

	_, err = ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("Webhook response code %s", resp.StatusCode)
	}

	defer resp.Body.Close()
	return nil
}

var addToWebhookQueue = func(msg *Webhook) {
	webhookQueue <- msg
}
