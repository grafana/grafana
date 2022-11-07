package loki

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

type mockedRoundTripperForOauth struct {
	requestCallback func(req *http.Request)
	body            []byte
}

func (mockedRT *mockedRoundTripperForOauth) RoundTrip(req *http.Request) (*http.Response, error) {
	mockedRT.requestCallback(req)
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(bytes.NewReader(mockedRT.body)),
	}, nil
}

type mockedCallResourceResponseSenderForOauth struct {
	Response *backend.CallResourceResponse
}

func (s *mockedCallResourceResponseSenderForOauth) Send(resp *backend.CallResourceResponse) error {
	s.Response = resp
	return nil
}

func makeMockedDsInfoForOauth(body []byte, requestCallback func(req *http.Request)) datasourceInfo {
	client := http.Client{
		Transport: &mockedRoundTripperForOauth{requestCallback: requestCallback, body: body},
	}

	return datasourceInfo{
		HTTPClient: &client,
	}
}

func TestOauthForwardIdentity(t *testing.T) {
	tt := []struct {
		name   string
		auth   bool
		cookie bool
	}{
		{name: "when auth headers exist => add auth headers", auth: true, cookie: false},
		{name: "when cookie header exists => add cookie header", auth: false, cookie: true},
		{name: "when cookie&auth headers exist => add cookie&auth headers", auth: true, cookie: true},
		{name: "when no header exists => do not add headers", auth: false, cookie: false},
	}

	authName := "Authorization"
	authValue := "auth"
	cookieName := "Cookie"
	cookieValue := "a=1"
	idTokenName := "X-ID-Token"
	idTokenValue := "idtoken"

	for _, test := range tt {
		t.Run("QueryData: "+test.name, func(t *testing.T) {
			response := []byte(`
				{
					"status": "success",
					"data": {
						"resultType": "streams",
						"result": [
							{
								"stream": {},
								"values": [
									["1", "line1"]
								]
							}
						]
					}
				}
			`)

			clientUsed := false
			dsInfo := makeMockedDsInfoForOauth(response, func(req *http.Request) {
				clientUsed = true
				// we need to check for "header does not exist",
				// and the only way i can find is to get the values
				// as an array
				authValues := req.Header.Values(authName)
				cookieValues := req.Header.Values(cookieName)
				idTokenValues := req.Header.Values(idTokenName)
				if test.auth {
					require.Equal(t, []string{authValue}, authValues)
					require.Equal(t, []string{idTokenValue}, idTokenValues)
				} else {
					require.Len(t, authValues, 0)
					require.Len(t, idTokenValues, 0)
				}
				if test.cookie {
					require.Equal(t, []string{cookieValue}, cookieValues)
				} else {
					require.Len(t, cookieValues, 0)
				}
			})

			req := backend.QueryDataRequest{
				Headers: map[string]string{},
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						JSON:  []byte("{}"),
					},
				},
			}

			if test.auth {
				req.Headers[authName] = authValue
				req.Headers[idTokenName] = idTokenValue
			}

			if test.cookie {
				req.Headers[cookieName] = cookieValue
			}

			tracer := tracing.InitializeTracerForTest()

			data, err := queryData(context.Background(), &req, &dsInfo, log.New("testlog"), tracer)
			// we do a basic check that the result is OK
			require.NoError(t, err)
			require.Len(t, data.Responses, 1)
			res := data.Responses["A"]
			require.NoError(t, res.Error)
			require.Len(t, res.Frames, 1)
			require.Equal(t, "line1", res.Frames[0].Fields[2].At(0))

			// we need to be sure the client-callback was triggered
			require.True(t, clientUsed)
		})
	}

	for _, test := range tt {
		t.Run("CallResource: "+test.name, func(t *testing.T) {
			response := []byte("mocked resource response")

			clientUsed := false
			dsInfo := makeMockedDsInfoForOauth(response, func(req *http.Request) {
				clientUsed = true
				authValues := req.Header.Values(authName)
				cookieValues := req.Header.Values(cookieName)
				idTokenValues := req.Header.Values(idTokenName)
				// we need to check for "header does not exist",
				// and the only way i can find is to get the values
				// as an array
				if test.auth {
					require.Equal(t, []string{authValue}, authValues)
					require.Equal(t, []string{idTokenValue}, idTokenValues)
				} else {
					require.Len(t, authValues, 0)
					require.Len(t, idTokenValues, 0)
				}
				if test.cookie {
					require.Equal(t, []string{cookieValue}, cookieValues)
				} else {
					require.Len(t, cookieValues, 0)
				}
			})

			req := backend.CallResourceRequest{
				Headers: map[string][]string{},
				Method:  "GET",
				URL:     "labels?",
			}

			if test.auth {
				req.Headers[authName] = []string{authValue}
				req.Headers[idTokenName] = []string{idTokenValue}
			}
			if test.cookie {
				req.Headers[cookieName] = []string{cookieValue}
			}

			sender := &mockedCallResourceResponseSenderForOauth{}

			err := callResource(context.Background(), &req, sender, &dsInfo, log.New("testlog"))
			// we do a basic check that the result is OK
			require.NoError(t, err)
			sent := sender.Response
			require.NotNil(t, sent)
			require.Equal(t, http.StatusOK, sent.Status)
			require.Equal(t, response, sent.Body)

			// we need to be sure the client-callback was triggered
			require.True(t, clientUsed)
		})
	}
}
