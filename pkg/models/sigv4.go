package models

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/credentials/stscreds"
	"github.com/aws/aws-sdk-go/aws/session"
	v4 "github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/aws/aws-sdk-go/private/protocol/rest"
)

type AuthType string

const (
	Default     AuthType = "default"
	Keys        AuthType = "keys"
	Credentials AuthType = "credentials"
)

// Host header is likely not necessary here
// (see https://github.com/golang/go/blob/cad6d1fef5147d31e94ee83934c8609d3ad150b7/src/net/http/request.go#L92)
// but adding for completeness
var permittedHeaders = map[string]struct{}{
	"Host":            {},
	"Uber-Trace-Id":   {},
	"User-Agent":      {},
	"Accept":          {},
	"Accept-Encoding": {},
}

type SigV4Middleware struct {
	Config *Config
	Next   http.RoundTripper
}

type Config struct {
	AuthType string

	Profile string

	DatasourceType string

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

	body, err := replaceBody(req)
	if err != nil {
		return nil, err
	}

	if strings.Contains(req.URL.RawPath, "%2C") {
		req.URL.RawPath = rest.EscapePath(req.URL.RawPath, false)
	}

	stripHeaders(req)

	return signer.Sign(req, bytes.NewReader(body), awsServiceNamespace(m.Config.DatasourceType), m.Config.Region, time.Now().UTC())
}

func (m *SigV4Middleware) signer() (*v4.Signer, error) {
	authType := AuthType(m.Config.AuthType)

	var c *credentials.Credentials
	switch authType {
	case Keys:
		c = credentials.NewStaticCredentials(m.Config.AccessKey, m.Config.SecretKey, "")
	case Credentials:
		c = credentials.NewSharedCredentials("", m.Config.Profile)
	case Default:
		// passing nil credentials will force AWS to allow a more complete credential chain vs the explicit default
		s, err := session.NewSession(&aws.Config{
			Region: aws.String(m.Config.Region),
		})
		if err != nil {
			return nil, err
		}

		if m.Config.AssumeRoleARN != "" {
			return v4.NewSigner(stscreds.NewCredentials(s, m.Config.AssumeRoleARN)), nil
		}

		return v4.NewSigner(s.Config.Credentials), nil
	case "":
		return nil, fmt.Errorf("invalid SigV4 auth type")
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

func replaceBody(req *http.Request) ([]byte, error) {
	if req.Body == nil {
		return []byte{}, nil
	}
	payload, err := ioutil.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}
	req.Body = ioutil.NopCloser(bytes.NewReader(payload))
	return payload, nil
}

func awsServiceNamespace(dsType string) string {
	switch dsType {
	case DS_ES:
		return "es"
	case DS_PROMETHEUS:
		return "aps"
	default:
		panic(fmt.Sprintf("Unsupported datasource %s", dsType))
	}
}

func stripHeaders(req *http.Request) {
	for h := range req.Header {
		if _, exists := permittedHeaders[h]; !exists {
			req.Header.Del(h)
		}
	}
}
