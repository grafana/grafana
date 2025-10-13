package response

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

func TestErrors(t *testing.T) {
	const fakeNotFoundMessage = "I looked, but did not find the thing"
	const genericErrorMessage = "Something went wrong in parsing the request"

	cases := []struct {
		name string

		// inputs
		err        error
		statusCode int
		message    string

		// responses
		legacyResponse *NormalResponse
		newResponse    *NormalResponse
		fallbackUseNew bool
		compareErr     bool
	}{
		{
			name: "base case",

			legacyResponse: &NormalResponse{},
			newResponse: &NormalResponse{
				status: http.StatusInternalServerError,
			},
		},
		{
			name: "not found error",

			err:        errors.New("not found"),
			statusCode: http.StatusNotFound,
			message:    fakeNotFoundMessage,

			legacyResponse: &NormalResponse{
				status:     http.StatusNotFound,
				errMessage: fakeNotFoundMessage,
			},
			newResponse: &NormalResponse{
				status: http.StatusInternalServerError,
			},
		},
		{
			name: "grafana error with fallback to other error",

			err:        errutil.Timeout("thing.timeout").Errorf("whoops"),
			statusCode: http.StatusBadRequest,
			message:    genericErrorMessage,

			legacyResponse: &NormalResponse{
				status:     http.StatusBadRequest,
				errMessage: genericErrorMessage,
			},
			newResponse: &NormalResponse{
				status:     http.StatusGatewayTimeout,
				errMessage: errutil.StatusTimeout.String(),
			},
			fallbackUseNew: true,
		},
	}

	compareResponses := func(expected *NormalResponse, actual *NormalResponse, compareErr bool) func(t *testing.T) {
		return func(t *testing.T) {
			if expected == nil {
				require.Nil(t, actual)
				return
			}

			require.NotNil(t, actual)
			assert.Equal(t, expected.status, actual.status)
			if expected.body != nil {
				assert.Equal(t, expected.body.Bytes(), actual.body.Bytes())
			}
			if expected.header != nil {
				assert.EqualValues(t, expected.header, actual.header)
			}
			assert.Equal(t, expected.errMessage, actual.errMessage)
			if compareErr {
				assert.ErrorIs(t, expected.err, actual.err)
			}
		}
	}

	for _, tc := range cases {
		tc := tc
		t.Run(
			tc.name+" Error",
			compareResponses(tc.legacyResponse, Error(
				tc.statusCode,
				tc.message,
				tc.err,
			), tc.compareErr),
		)

		t.Run(
			tc.name+" Err",
			compareResponses(tc.newResponse, Err(
				tc.err,
			), tc.compareErr),
		)

		fallbackResponse := tc.legacyResponse
		if tc.fallbackUseNew {
			fallbackResponse = tc.newResponse
		}
		t.Run(
			tc.name+" ErrOrFallback",
			compareResponses(fallbackResponse, ErrOrFallback(
				tc.statusCode,
				tc.message,
				tc.err,
			), tc.compareErr),
		)
	}
}

func TestRespond(t *testing.T) {
	testCases := []struct {
		name     string
		status   int
		body     any
		expected []byte
	}{
		{
			name:     "with body of type []byte",
			status:   200,
			body:     []byte("message body"),
			expected: []byte("message body"),
		},
		{
			name:     "with body of type string",
			status:   400,
			body:     "message body",
			expected: []byte("message body"),
		},
		{
			name:     "with nil body",
			status:   204,
			body:     nil,
			expected: nil,
		},
		{
			name:   "with body of type struct",
			status: 200,
			body: struct {
				Name  string
				Value int
			}{"name", 1},
			expected: []byte(`{"Name":"name","Value":1}`),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resp := Respond(tc.status, tc.body)

			require.Equal(t, tc.status, resp.status)
			require.Equal(t, tc.expected, resp.body.Bytes())
		})
	}
}
