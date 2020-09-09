package models

import (
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws/credentials"

	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
)

const (
	sigV4Enabled = false
)

type Sigv4Middleware struct {
	Config *Config
	Next   http.RoundTripper
}

type Config struct {
	Region    string
	AccessKey string
	SecretKey string
}

func (m *Sigv4Middleware) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.Next == nil {
		return http.DefaultTransport.RoundTrip(req)
	}

	if sigV4Enabled {
		err := m.signRequest(req)
		if err != nil {
			return nil, err
		}
	}

	return m.Next.RoundTrip(req)
}

func (m *Sigv4Middleware) signRequest(req *http.Request) error {
	signer := v4.NewSigner(credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, ""))
	_, err := signer.Sign(req, nil, "grafana", m.Config.Region, time.Now())

	return err
}
