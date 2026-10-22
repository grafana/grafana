package teamlbac

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestForSubjectMetricsCountsTeamsWithoutLegacyIDs(t *testing.T) {
	for _, tt := range []struct {
		name string
		id   string
		want float64
	}{
		{name: "missing label", want: 1},
		{name: "malformed", id: "invalid", want: 1},
		{name: "zero", id: "0", want: 1},
		{name: "negative", id: "-42", want: 1},
		{name: "overflow", id: "9223372036854775808", want: 1},
		{name: "positive", id: "42"},
		{name: "leading zeros", id: "0042"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			reg := prometheus.NewRegistry()
			metrics := newForSubjectMetrics(reg)
			require.Zero(t, testutil.ToFloat64(metrics.listedTeamsWithoutLegacyID))
			team := iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "team-a"}}
			if tt.id != "" {
				team.Labels = map[string]string{apiutils.LabelKeyDeprecatedInternalID: tt.id} //nolint:staticcheck // observe invalid legacy IDs
			}
			metrics.countTeamsWithoutLegacyIDs([]iamv0.Team{team})
			metrics.countTeamsWithoutLegacyIDs(nil)
			require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(fmt.Sprintf(`
# HELP grafana_team_lbac_for_subject_listed_teams_without_legacy_id_total Listed Team observations without a valid positive legacy numeric ID during for-subject evaluation; repeated evaluations count the same Team again
# TYPE grafana_team_lbac_for_subject_listed_teams_without_legacy_id_total counter
grafana_team_lbac_for_subject_listed_teams_without_legacy_id_total %g
`, tt.want)), "grafana_team_lbac_for_subject_listed_teams_without_legacy_id_total"))
		})
	}
}

func TestForSubjectErrorClass(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"canceled", fmt.Errorf("read: %w", context.Canceled), "canceled"},
		{"deadline", context.DeadlineExceeded, "timeout"},
		{"unavailable", apierrors.NewServiceUnavailable("unavailable"), "unavailable"},
		{"forbidden", apierrors.NewForbidden(schema.GroupResource{Resource: "teamlbacrules"}, "rule", errors.New("denied")), "authorization"},
		{"other", errors.New("database failed"), "internal"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, string(classifyForSubjectError(tt.err)))
		})
	}
}

func TestForSubjectDatasourceTypeIsBounded(t *testing.T) {
	require.Equal(t, "prometheus", forSubjectDatasourceType("prometheus.datasource-a"))
	require.Equal(t, "other", forSubjectDatasourceType("custom-plugin.datasource-a"))
	require.Equal(t, "other", forSubjectDatasourceType("malformed"))
}
