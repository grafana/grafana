package util_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util"
)

func TestSearchJSONForGroups(t *testing.T) {
	t.Parallel()
	tests := []struct {
		Name                string
		searchObject        any
		GroupsAttributePath string
		ExpectedResult      []string
		ExpectedError       error
	}{
		{
			Name:                "Given an invalid user info JSON response",
			searchObject:        []byte("{"),
			GroupsAttributePath: "attributes.groups",
			ExpectedResult:      []string{},
			ExpectedError:       util.ErrFailedToUnmarshalJSON,
		},
		{
			Name:                "Given an empty user info JSON response and empty JMES path",
			searchObject:        []byte{},
			GroupsAttributePath: "",
			ExpectedResult:      []string{},
			ExpectedError:       util.ErrNoAttributePathSpecified,
		},
		{
			Name:                "Given an empty user info JSON response and valid JMES path",
			searchObject:        []byte{},
			GroupsAttributePath: "attributes.groups",
			ExpectedResult:      []string{},
			ExpectedError:       util.ErrEmptyJSON,
		},
		{
			Name:                "Given a nil JSON and valid JMES path",
			searchObject:        []byte{},
			GroupsAttributePath: "attributes.groups",
			ExpectedResult:      []string{},
			ExpectedError:       util.ErrEmptyJSON,
		},
		{
			Name: "Given a simple user info JSON response and valid JMES path",
			searchObject: []byte(`{
		"attributes": {
			"groups": ["foo", "bar"]
		}
}`),
			GroupsAttributePath: "attributes.groups[]",
			ExpectedResult:      []string{"foo", "bar"},
		},
		{
			Name: "Given a simple object and valid JMES path",
			searchObject: map[string]any{
				"attributes": map[string]any{
					"groups": []string{"foo", "bar"},
				},
			},
			GroupsAttributePath: "attributes.groups[]",
			ExpectedResult:      []string{"foo", "bar"},
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.Name, func(t *testing.T) {
			t.Parallel()
			actualResult, err := util.SearchJSONForStringSliceAttr(
				test.GroupsAttributePath, test.searchObject)
			if test.ExpectedError == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, test.ExpectedError)
			}
			require.Equal(t, test.ExpectedResult, actualResult)
		})
	}
}

func TestSearchJSONForEmail(t *testing.T) {
	t.Parallel()
	tests := []struct {
		Name                 string
		UserInfoJSONResponse any
		EmailAttributePath   string
		ExpectedResult       string
		ExpectedError        error
	}{
		{
			Name: "Given a simple user info JSON response and valid JMES path",
			UserInfoJSONResponse: []byte(`{
				"attributes": {
					"email": "grafana@localhost"
				}
			}`),
			EmailAttributePath: "attributes.email",
			ExpectedResult:     "grafana@localhost",
		},
		{
			Name: "Given a simple object and valid JMES path",
			UserInfoJSONResponse: map[string]any{
				"attributes": map[string]any{
					"email": "grafana@localhost",
				},
			},
			EmailAttributePath: "attributes.email",
			ExpectedResult:     "grafana@localhost",
		},
		{
			Name: "Given a user info JSON response with e-mails array and valid JMES path",
			UserInfoJSONResponse: []byte(`{
				"attributes": {
					"emails": ["grafana@localhost", "admin@localhost"]
				}
			}`),
			EmailAttributePath: "attributes.emails[0]",
			ExpectedResult:     "grafana@localhost",
		},
		{
			Name: "Given a nested user info JSON response and valid JMES path",
			UserInfoJSONResponse: []byte(`{
				"identities": [
					{
						"userId": "grafana@localhost"
					},
					{
						"userId": "admin@localhost"
					}
				]
			}`),
			EmailAttributePath: "identities[0].userId",
			ExpectedResult:     "grafana@localhost",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.Name, func(t *testing.T) {
			t.Parallel()
			actualResult, err := util.SearchJSONForStringAttr(test.EmailAttributePath, test.UserInfoJSONResponse)
			if test.ExpectedError != nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, test.ExpectedError)
			}
			require.Equal(t, test.ExpectedResult, actualResult)
		})
	}
}

func TestSearchJSONForBoolAttr(t *testing.T) {
	tests := []struct {
		name          string
		data          []byte
		path          string
		expectedValue bool
		err           bool
	}{
		{
			name: "should parse and find the boolean value of attribute",
			data: []byte(`{
				"attribute": true
			}`),
			path:          "attribute",
			expectedValue: true,
		},
		{
			name: "should return false if the attribute is a false string",
			data: []byte(`{
				"attribute": "false"
			}`),
			path: "attribute",
		},
		{
			name: "should return error if the payload is not parseable",
			data: []byte(`{
				"attribute"
			}`),
			path: "attribute",
			err:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, err := util.SearchJSONForBoolAttr(tt.path, tt.data)
			if tt.err {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tt.expectedValue, response)
		})
	}
}
