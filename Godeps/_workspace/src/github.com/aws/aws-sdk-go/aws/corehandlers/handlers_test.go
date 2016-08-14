package corehandlers_test

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/corehandlers"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/awstesting"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/service/s3"
)

func TestValidateEndpointHandler(t *testing.T) {
	os.Clearenv()

	svc := awstesting.NewClient(aws.NewConfig().WithRegion("us-west-2"))
	svc.Handlers.Clear()
	svc.Handlers.Validate.PushBackNamed(corehandlers.ValidateEndpointHandler)

	req := svc.NewRequest(&request.Operation{Name: "Operation"}, nil, nil)
	err := req.Build()

	assert.NoError(t, err)
}

func TestValidateEndpointHandlerErrorRegion(t *testing.T) {
	os.Clearenv()

	svc := awstesting.NewClient()
	svc.Handlers.Clear()
	svc.Handlers.Validate.PushBackNamed(corehandlers.ValidateEndpointHandler)

	req := svc.NewRequest(&request.Operation{Name: "Operation"}, nil, nil)
	err := req.Build()

	assert.Error(t, err)
	assert.Equal(t, aws.ErrMissingRegion, err)
}

type mockCredsProvider struct {
	expired        bool
	retrieveCalled bool
}

func (m *mockCredsProvider) Retrieve() (credentials.Value, error) {
	m.retrieveCalled = true
	return credentials.Value{ProviderName: "mockCredsProvider"}, nil
}

func (m *mockCredsProvider) IsExpired() bool {
	return m.expired
}

func TestAfterRetryRefreshCreds(t *testing.T) {
	os.Clearenv()
	credProvider := &mockCredsProvider{}

	svc := awstesting.NewClient(&aws.Config{
		Credentials: credentials.NewCredentials(credProvider),
		MaxRetries:  aws.Int(1),
	})

	svc.Handlers.Clear()
	svc.Handlers.ValidateResponse.PushBack(func(r *request.Request) {
		r.Error = awserr.New("UnknownError", "", nil)
		r.HTTPResponse = &http.Response{StatusCode: 400, Body: ioutil.NopCloser(bytes.NewBuffer([]byte{}))}
	})
	svc.Handlers.UnmarshalError.PushBack(func(r *request.Request) {
		r.Error = awserr.New("ExpiredTokenException", "", nil)
	})
	svc.Handlers.AfterRetry.PushBackNamed(corehandlers.AfterRetryHandler)

	assert.True(t, svc.Config.Credentials.IsExpired(), "Expect to start out expired")
	assert.False(t, credProvider.retrieveCalled)

	req := svc.NewRequest(&request.Operation{Name: "Operation"}, nil, nil)
	req.Send()

	assert.True(t, svc.Config.Credentials.IsExpired())
	assert.False(t, credProvider.retrieveCalled)

	_, err := svc.Config.Credentials.Get()
	assert.NoError(t, err)
	assert.True(t, credProvider.retrieveCalled)
}

type testSendHandlerTransport struct{}

func (t *testSendHandlerTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return nil, fmt.Errorf("mock error")
}

func TestSendHandlerError(t *testing.T) {
	svc := awstesting.NewClient(&aws.Config{
		HTTPClient: &http.Client{
			Transport: &testSendHandlerTransport{},
		},
	})
	svc.Handlers.Clear()
	svc.Handlers.Send.PushBackNamed(corehandlers.SendHandler)
	r := svc.NewRequest(&request.Operation{Name: "Operation"}, nil, nil)

	r.Send()

	assert.Error(t, r.Error)
	assert.NotNil(t, r.HTTPResponse)
}

func setupContentLengthTestServer(t *testing.T, hasContentLength bool, contentLength int64) *httptest.Server {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := r.Header["Content-Length"]
		assert.Equal(t, hasContentLength, ok, "expect content length to be set, %t", hasContentLength)
		assert.Equal(t, contentLength, r.ContentLength)

		b, err := ioutil.ReadAll(r.Body)
		assert.NoError(t, err)
		r.Body.Close()

		authHeader := r.Header.Get("Authorization")
		if hasContentLength {
			assert.Contains(t, authHeader, "content-length")
		} else {
			assert.NotContains(t, authHeader, "content-length")
		}

		assert.Equal(t, contentLength, int64(len(b)))
	}))

	return server
}

func TestBuildContentLength_ZeroBody(t *testing.T) {
	server := setupContentLengthTestServer(t, false, 0)

	svc := s3.New(unit.Session, &aws.Config{
		Endpoint:         aws.String(server.URL),
		S3ForcePathStyle: aws.Bool(true),
		DisableSSL:       aws.Bool(true),
	})
	_, err := svc.GetObject(&s3.GetObjectInput{
		Bucket: aws.String("bucketname"),
		Key:    aws.String("keyname"),
	})

	assert.NoError(t, err)
}

func TestBuildContentLength_NegativeBody(t *testing.T) {
	server := setupContentLengthTestServer(t, false, 0)

	svc := s3.New(unit.Session, &aws.Config{
		Endpoint:         aws.String(server.URL),
		S3ForcePathStyle: aws.Bool(true),
		DisableSSL:       aws.Bool(true),
	})
	req, _ := svc.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String("bucketname"),
		Key:    aws.String("keyname"),
	})

	req.HTTPRequest.Header.Set("Content-Length", "-1")

	assert.NoError(t, req.Send())
}

func TestBuildContentLength_WithBody(t *testing.T) {
	server := setupContentLengthTestServer(t, true, 1024)

	svc := s3.New(unit.Session, &aws.Config{
		Endpoint:         aws.String(server.URL),
		S3ForcePathStyle: aws.Bool(true),
		DisableSSL:       aws.Bool(true),
	})
	_, err := svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String("bucketname"),
		Key:    aws.String("keyname"),
		Body:   bytes.NewReader(make([]byte, 1024)),
	})

	assert.NoError(t, err)
}
