package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseError(t *testing.T) {
	bodyShort := `{
		"error":{
		   "code":"BadRequest",
		   "message":"Please provide below info when asking for support: timestamp = 2022-01-17T15:50:07.9782199Z, correlationId = 7ba435e5-6371-458f-a1b5-1c7ffdba6ff4.",
		   "details":[
			  {
				 "code":"InvalidQuery",
				 "message":"Query is invalid. Please refer to the documentation for the Azure Resource Graph service and fix the error before retrying."
			  },
			  {
				 "code":"UnknownFunction",
				 "message":"Unknown function: 'cout'."
			  }
		   ]
		}
	 }`
	expectedErrMsgShort := `BadRequest
InvalidQuery: Query is invalid. Please refer to the documentation for the Azure Resource Graph service and fix the error before retrying.
UnknownFunction: Unknown function: 'cout'.
Please provide below info when asking for support: timestamp = 2022-01-17T15:50:07.9782199Z, correlationId = 7ba435e5-6371-458f-a1b5-1c7ffdba6ff4.`
	bodyWithLines := `{
		"error":
		{
			"code": "BadRequest",
			"message": "Please provide below info when asking for support: timestamp = 2021-06-04T05:09:13.1870573Z, correlationId = f1c5d97f-26db-4bdc-b023-1f0a862004db.",
			"details":
			[
				{
					"code": "InvalidQuery",
					"message": "Query is invalid. Please refer to the documentation for the Azure Resource Graph service and fix the error before retrying."
				},
				{
					"code": "ParserFailure",
					"message": "ParserFailure",
					"line": 2,
					"token": "<"
				},
				{
					"code": "ParserFailure",
					"message": "ParserFailure",
					"line": 4,
					"characterPositionInLine": 23,
					"token": "<"
				}
			]
		}
	}`
	expectedErrMsgWithLines := `BadRequest
InvalidQuery: Query is invalid. Please refer to the documentation for the Azure Resource Graph service and fix the error before retrying.
ParserFailure: ParserFailure at line 2: "<"
ParserFailure: ParserFailure at line 4, col 23: "<"
Please provide below info when asking for support: timestamp = 2021-06-04T05:09:13.1870573Z, correlationId = f1c5d97f-26db-4bdc-b023-1f0a862004db.`
	bodyUnexpected := `{
		"error":"I m an expected field but of wrong type ! "
	}`
	expectedErrUnexpectedError := "json: cannot unmarshal string into Go struct field XModelExceptions.error of type utils.ErrorObject"
	expectedErrMsgUnexpectedError := bodyUnexpected
	bodyUnexpected2 := `{
		"myerror":"I m completly unexpected and you won't know how to parse me ! ",
		"code":"boom"
	}`
	expectedErrMsgUnexpectedError2 := bodyUnexpected2
	expectedErrUnexpectedError2 := `json: unknown field "myerror"`

	tests := []struct {
		name        string
		body        string
		expectedRes string
		expectedErr string
	}{
		{
			name:        "short error",
			body:        bodyShort,
			expectedRes: expectedErrMsgShort,
		},
		{
			name:        "error with lines",
			body:        bodyWithLines,
			expectedRes: expectedErrMsgWithLines,
		},
		{
			name:        "unexpected error format",
			body:        bodyUnexpected,
			expectedRes: expectedErrMsgUnexpectedError,
			expectedErr: expectedErrUnexpectedError,
		},
		{
			name:        "unexpected error format",
			body:        bodyUnexpected2,
			expectedRes: expectedErrMsgUnexpectedError2,
			expectedErr: expectedErrUnexpectedError2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ParseError([]byte(tt.body))

			assert.Equal(t, tt.expectedRes, res)
			if tt.expectedErr != "" {
				assert.Equal(t, tt.expectedErr, err.Error())
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
