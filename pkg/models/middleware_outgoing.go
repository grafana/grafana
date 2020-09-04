package models

import (
	"log"
	"net/http"
	"time"

	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"

	"github.com/aws/aws-sdk-go/aws/credentials"
)

const (
	sigV4Enabled = false
)

type Sigv4Middleware struct {
	Region      string
	Credentials *credentials.Credentials
	Next        http.RoundTripper
}

func (m *Sigv4Middleware) RoundTrip(req *http.Request) (*http.Response, error) {
	log.Println("Signing with sigv4")

	if m.Next == nil {
		return http.DefaultTransport.RoundTrip(req)
	}

	if sigV4Enabled {
		err := m.signRequest(req)
		if err != nil {
			log.Printf("Failed to sign request: (%v)\n", err)
		}
	}

	return m.Next.RoundTrip(req)
}

func (m *Sigv4Middleware) signRequest(req *http.Request) error {
	signer := v4.NewSigner(m.Credentials)
	_, err := signer.Sign(req, nil, "grafana", m.Region, time.Now())

	return err
}
