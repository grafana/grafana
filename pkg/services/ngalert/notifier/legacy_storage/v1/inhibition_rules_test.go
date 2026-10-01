package v1

import (
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
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

func TestInhibitionRuleManagerStorage(t *testing.T) {
	newRule := func() InhibitionRule {
		return NewInhibitionRule(
			"rule",
			[]Matcher{NewMatcher(MatcherEqual, "alertname", "Source")},
			[]Matcher{NewMatcher(MatcherEqual, "alertname", "Target")},
			[]string{"instance"},
			models.ProvenanceNone,
		)
	}
	roundTrip := func(t *testing.T, rule InhibitionRule) (*definitions.InhibitionRule, InhibitionRule) {
		t.Helper()
		stored, err := InhibitionRuleToDB(rule)
		require.NoError(t, err)
		data, err := json.Marshal(stored)
		require.NoError(t, err)
		var decoded definitions.InhibitionRule
		require.NoError(t, json.Unmarshal(data, &decoded))
		return stored, InhibitionRuleToModel(decoded)
	}

	t.Run("a specific manager is stored inline and read back", func(t *testing.T) {
		terraform := utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "tf-id"}
		rule := newRule()
		rule.SetManager(terraform)

		stored, read := roundTrip(t, rule)

		assert.Equal(t, string(utils.ManagerKindTerraform), stored.ManagerKind)
		assert.Equal(t, "tf-id", stored.ManagerIdentity)
		assert.Equal(t, terraform, read.Manager)
		assert.Equal(t, models.ProvenanceAPI, read.Provenance)
		assert.Equal(t, rule.Version, read.Version, "the manager must not change the version")
	})

	t.Run("a manager that the provenance expresses is not stored", func(t *testing.T) {
		rule := newRule()
		rule.SetManager(models.ProvenanceToManagerProperties(models.ProvenanceAPI))

		stored, read := roundTrip(t, rule)

		assert.Empty(t, stored.ManagerKind)
		assert.Empty(t, stored.ManagerIdentity)
		assert.Equal(t, models.ProvenanceAPI, read.Provenance)
		assert.Equal(t, models.ProvenanceToManagerProperties(models.ProvenanceAPI), read.Manager)
	})

	t.Run("rules stored without manager fields derive the manager from provenance", func(t *testing.T) {
		var decoded definitions.InhibitionRule
		require.NoError(t, json.Unmarshal([]byte(`{"name":"old-rule","source_matchers":["alertname=\"A\""],"target_matchers":["alertname=\"B\""],"provenance":"file"}`), &decoded))

		read := InhibitionRuleToModel(decoded)

		assert.Equal(t, models.ProvenanceFile, read.Provenance)
		assert.Equal(t, models.ProvenanceToManagerProperties(models.ProvenanceFile), read.Manager)
		assert.Equal(t, ResourceUID("old-rule"), read.UID)
	})
}
