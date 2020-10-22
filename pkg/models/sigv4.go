package models

import (
	"bytes"
	"fmt"
	"io/ioutil"
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
	signer, err := m.signer()
	if err != nil {
		return nil, err
	}

	if req.Body != nil {
		// consume entire request body so that the signer can generate a hash from the contents
		body, err := ioutil.ReadAll(req.Body)
		if err != nil {
			return nil, err
		}
		return signer.Sign(req, bytes.NewReader(body), "grafana", m.Config.Region, time.Now().UTC())
	}
	return signer.Sign(req, nil, "grafana", m.Config.Region, time.Now().UTC())
}

func (m *SigV4Middleware) signer() (*v4.Signer, error) {
	c, err := m.credentials()
	if err != nil {
		return nil, err
	}

	if m.Config.AssumeRoleARN != "" {
		s, err := session.NewSession(&aws.Config{
			Region:      aws.String(m.Config.Region),
			Credentials: c},
		)
		if err != nil {
			return nil, err
		}
		return v4.NewSigner(stscreds.NewCredentials(s, m.Config.AssumeRoleARN)), nil
	}

	return v4.NewSigner(c), nil
}

func (m *SigV4Middleware) credentials() (*credentials.Credentials, error) {
	authType := AuthType(m.Config.AuthType)

	switch authType {
	case Default:
		return defaults.CredChain(defaults.Config(), defaults.Handlers()), nil
	case Keys:
		return credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, ""), nil
	case Credentials:
		return credentials.NewSharedCredentials("", m.Config.Profile), nil
	}

	return nil, fmt.Errorf("unrecognized authType: %s", authType)
}
