package models

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go/aws"

	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"

	"github.com/aws/aws-sdk-go/aws/defaults"

	"github.com/aws/aws-sdk-go/aws/credentials"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
)

type AuthType string

const (
	Default     AuthType = "default"
	Keys        AuthType = "keys"
	Credentials AuthType = "credentials"
)

type SigV4Middleware struct {
	Config *Config
	Next   http.RoundTripper
}

type Config struct {
	AuthType string

	Profile string

	AccessKey string
	SecretKey string

	AssumeRoleARN string
	ExternalID    string
	Region        string
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

	creds := defaults.CredChain(defaults.Config(), defaults.Handlers())
	switch authType {
	case Keys:
		creds = credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, "")
	case Credentials:
		creds = credentials.NewSharedCredentials("", m.Config.Profile)
	default:
		return nil, fmt.Errorf("unrecognized authType: %s", authType)
	}

	if m.Config.AssumeRoleARN != "" {
		s, err := session.NewSession(&aws.Config{
			Region:      aws.String(m.Config.Region),
			Credentials: creds},
		)
		if err != nil {
			return nil, err
		}
		return stscreds.NewCredentials(s, m.Config.AssumeRoleARN), nil
	}

	return creds, nil
}
