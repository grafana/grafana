package models

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
)

type AuthType string

const (
	Keys        AuthType = "keys"
	Credentials AuthType = "credentials"
	ARN         AuthType = "arn"
)

type SigV4Middleware struct {
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

func (m *SigV4Middleware) RoundTrip(req *http.Request) (*http.Response, error) {
	_, err := m.signRequest(req)
	if err != nil {
		return nil, err
	}

	if m.Next == nil {
		return http.DefaultTransport.RoundTrip(req)
	}

	return m.Next.RoundTrip(req)
}

func (m *SigV4Middleware) signRequest(req *http.Request) (http.Header, error) {
	creds, err := m.credentials()
	if err != nil {
		return nil, err
	}

	signer := v4.NewSigner(creds)
	return signer.Sign(req, nil, "grafana", m.Config.Region, time.Now())
}

func (m *SigV4Middleware) credentials() (*credentials.Credentials, error) {
	authType := AuthType(m.Config.AuthType)

	switch authType {
	case Keys:
		return credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, ""), nil
	case Credentials:
		return credentials.NewSharedCredentials("", m.Config.Profile), nil
	case ARN:
		s := session.Must(session.NewSession())
		return stscreds.NewCredentials(s, m.Config.AssumeRoleARN), nil
	}

	return nil, fmt.Errorf("invalid auth type %s was specified", authType)
}
