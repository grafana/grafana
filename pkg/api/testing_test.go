package api

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
)

func TestRulePayloadMarshaling(t *testing.T) {
	for _, tc := range []struct {
		desc  string
		input TestRulePayload
		err   bool
	}{
		{
			desc: "success lotex",
			input: TestRulePayload{
				Expr: "rate({cluster=\"us-central1\", job=\"loki-prod/loki-canary\"}[1m]) > 0",
			},
		},
		{
			desc: "success grafana",
			input: TestRulePayload{
				GrafanaManagedCondition: &models.EvalAlertConditionCommand{},
			},
		},
		{
			desc: "failure mixed",
			input: TestRulePayload{
				Expr:                    "rate({cluster=\"us-central1\", job=\"loki-prod/loki-canary\"}[1m]) > 0",
				GrafanaManagedCondition: &models.EvalAlertConditionCommand{},
			},
			err: true,
		},
		{
			desc:  "failure both empty",
			input: TestRulePayload{},
			err:   true,
		},
	} {
		t.Run(tc.desc, func(t *testing.T) {
			encoded, err := json.Marshal(tc.input)
			require.Nil(t, err)

			var out TestRulePayload
			err = json.Unmarshal(encoded, &out)

			if tc.err {
				require.Error(t, err)
			} else {
				require.Nil(t, err)
				require.Equal(t, tc.input, out)
			}
		})
	}
}
