package models

import (
	"errors"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
)

type Sigv4Middleware struct {
	Config *Config
	Next   http.RoundTripper
}

type Config struct {
	AuthType string

	Profile string

	AssumeRoleARN string
	ExternalID    string

	AccessKey string
	SecretKey string

	Region string
}

func (m *Sigv4Middleware) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.Next == nil {
		return http.DefaultTransport.RoundTrip(req)
	}

	err := m.signRequest(req)
	if err != nil {
		return nil, err
	}

	return m.Next.RoundTrip(req)
}

func (m *Sigv4Middleware) signRequest(req *http.Request) error {
	creds := m.credentials()
	if creds == nil {
		return errors.New("invalid credentials option")
	}

	signer := v4.NewSigner(creds)
	_, err := signer.Sign(req, nil, "grafana", m.Config.Region, time.Now())

	return err
}

func (m *Sigv4Middleware) credentials() *credentials.Credentials {
	switch m.Config.AuthType {
	case "keys":
		return credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, "")
	case "credentials":
		return credentials.NewSharedCredentials("", m.Config.Profile)
	case "arn":
		s := session.Must(session.NewSession())
		return stscreds.NewCredentials(s, m.Config.AssumeRoleARN)
	}

	return nil
}
