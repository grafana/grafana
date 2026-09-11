package v1

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func Test_Validate(t *testing.T) {
	testRule := func() InhibitionRule {
		return InhibitionRule{
			ResourceMetadata: ResourceMetadata{
				UID: "inhibition-rule-1",
			},
			SourceMatchers: []Matcher{
				{
					Type:  MatcherEqual,
					Label: "instance",
					Value: "alertmanager-1",
				},
			},
			TargetMatchers: []Matcher{
				{
					Type:  MatcherEqual,
					Label: "instance",
					Value: "alertmanager-2",
				},
			},
			Equal: []string{
				"service",
			},
		}
	}

	tt := []struct {
		name        string
		inhibitRule InhibitionRule
		expErr      error
	}{
		{
			name: "fails when uid is empty",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = ""
				return tr
			}(),
			expErr: errors.New("inhibition rule uid must not be empty"),
		},
		{
			name: "fails when uid contains ':'",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = "a:b"
				return tr
			}(),
			expErr: errors.New("inhibition rule uid cannot contain invalid character ':'"),
		},
		{
			name: "fails when uid is not a valid dns 1123 subdomain",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = "_some_name"
				return tr
			}(),
			expErr: errors.New("inhibition rule uid must be a valid DNS subdomain: a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')"),
		},
		{
			name: "fails when length of non-imported rule uid is over UIDMaxLength limit",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = "some-really-long-inhibition-rule-name-001"
				return tr
			}(),
			expErr: errors.New("inhibition rule uid is too long (exceeds 40 characters)"),
		},
		{
			name: "allows length of imported rule uid to be over UIDMaxLength limit",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = "some-really-long-inhibition-rule-name-001"
				tr.Provenance = models.ProvenanceConvertedPrometheus
				return tr
			}(),
			expErr: nil,
		},
		{
			name: "valid model passes all validations",
			inhibitRule: func() InhibitionRule {
				tr := testRule()
				tr.UID = "inhibition-rule-1"
				tr.Provenance = models.ProvenanceNone
				return tr
			}(),
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			gotErr := tc.inhibitRule.Validate()
			if tc.expErr != nil {
				require.EqualError(t, gotErr, tc.expErr.Error())
			} else {
				require.Nil(t, gotErr)
			}
		})
	}
}
