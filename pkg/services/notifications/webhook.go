package notifications

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"time"

	"golang.org/x/net/context/ctxhttp"

	"github.com/grafana/grafana/pkg/util"
)

type Webhook struct {
	Url         string
	User        string
	Password    string
	Body        string
	HttpMethod  string
	HttpHeader  map[string]string
	ContentType string
}

var netTransport = &http.Transport{
	TLSClientConfig: &tls.Config{
		Renegotiation: tls.RenegotiateFreelyAsClient,
	},
	Proxy: http.ProxyFromEnvironment,
	Dial: (&net.Dialer{
		Timeout: 30 * time.Second,
	}).Dial,
	TLSHandshakeTimeout: 5 * time.Second,
}
var netClient = &http.Client{
	Timeout:   time.Second * 30,
	Transport: netTransport,
}

func (ns *NotificationService) sendWebRequestSync(ctx context.Context, webhook *Webhook) error {
	ns.log.Debug("Sending webhook", "url", webhook.Url, "http method", webhook.HttpMethod)

	if webhook.HttpMethod == "" {
		webhook.HttpMethod = http.MethodPost
	}

	request, err := http.NewRequest(webhook.HttpMethod, webhook.Url, bytes.NewReader([]byte(webhook.Body)))
	if err != nil {
		return err
	}

	if webhook.ContentType == "" {
		webhook.ContentType = "application/json"
	}

	request.Header.Add("Content-Type", webhook.ContentType)
	request.Header.Add("User-Agent", "Grafana")

	if webhook.User != "" && webhook.Password != "" {
		request.Header.Add("Authorization", util.GetBasicAuthHeader(webhook.User, webhook.Password))
	}

	for k, v := range webhook.HttpHeader {
		request.Header.Set(k, v)
	}

	resp, err := ctxhttp.Do(ctx, netClient, request)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode/100 == 2 {
		// flushing the body enables the transport to reuse the same connection
		io.Copy(ioutil.Discard, resp.Body)
		return nil
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	ns.log.Debug("Webhook failed", "statuscode", resp.Status, "body", string(body))
	return fmt.Errorf("Webhook response status %v", resp.Status)
}
