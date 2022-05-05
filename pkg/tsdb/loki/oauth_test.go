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

func makeMockedDsInfoForOauth(oauthPassThru bool, body []byte, requestCallback func(req *http.Request)) datasourceInfo {
	client := http.Client{
		Transport: &mockedRoundTripperForOauth{requestCallback: requestCallback, body: body},
	}

	return datasourceInfo{
		HTTPClient:    &client,
		OauthPassThru: oauthPassThru,
	}
}

func TestOauthForwardIdentity(t *testing.T) {
	tt := []struct {
		name          string
		oauthPassThru bool
		headerGiven   bool
		headerSent    bool
	}{
		{name: "when enabled and headers exist => add headers", oauthPassThru: true, headerGiven: true, headerSent: true},
		{name: "when disabled and headers exist => do not add headers", oauthPassThru: false, headerGiven: true, headerSent: false},
		{name: "when enabled and no headers exist => do not add headers", oauthPassThru: true, headerGiven: false, headerSent: false},
		{name: "when disabled and no headers exist => do not add headers", oauthPassThru: false, headerGiven: false, headerSent: false},
	}

	authName := "Authorization"
	authValue := "auth"

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
			dsInfo := makeMockedDsInfoForOauth(test.oauthPassThru, response, func(req *http.Request) {
				clientUsed = true
				if test.headerSent {
					require.Equal(t, authValue, req.Header.Get(authName))
				} else {
					require.Equal(t, "", req.Header.Get(authName))
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

			if test.headerGiven {
				req.Headers[authName] = authValue
			}

			tracer, err := tracing.InitializeTracerForTest()
			require.NoError(t, err)

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
			dsInfo := makeMockedDsInfoForOauth(test.oauthPassThru, response, func(req *http.Request) {
				clientUsed = true
				if test.headerSent {
					require.Equal(t, authValue, req.Header.Get(authName))
				} else {
					require.Equal(t, "", req.Header.Get(authName))
				}
			})

			req := backend.CallResourceRequest{
				Headers: map[string][]string{},
				Method:  "GET",
				URL:     "labels?",
			}

			if test.headerGiven {
				req.Headers[authName] = []string{authValue}
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
