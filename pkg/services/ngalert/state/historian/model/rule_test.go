package model

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestNewRuleMeta(t *testing.T) {
	logger := log.NewNopLogger()

	type testCase struct {
		name     string
		in       models.AlertRule
		expDash  string
		expPanel int64
	}

	cases := []testCase{
		{
			name: "no dash UID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.PanelIDAnnotation: "123",
				},
			},
			expDash:  "",
			expPanel: 0,
		},
		{
			name: "no panel ID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
				},
			},
			expDash:  "",
			expPanel: 0,
		},
		{
			name: "invalid panel ID",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
					models.PanelIDAnnotation:      "bad-id",
				},
			},
			expDash:  "",
			expPanel: 0,
		},
		{
			name: "success",
			in: models.AlertRule{
				OrgID: 1,
				Annotations: map[string]string{
					models.DashboardUIDAnnotation: "abcd-uid",
					models.PanelIDAnnotation:      "123",
				},
			},
			expDash:  "abcd-uid",
			expPanel: 123,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := NewRuleMeta(&tc.in, logger)
			require.Equal(t, tc.expDash, res.DashboardUID)
			require.Equal(t, tc.expPanel, res.PanelID)
		})
	}
}
