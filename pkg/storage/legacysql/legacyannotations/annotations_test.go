package legacyannotations

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// dashboardLike derives more from columns than a data source does, which is the
// whole reason the derived set is per-resource.
var dashboardLike = NewPolicy(utils.AnnoKeyUpdatedTimestamp, utils.AnnoKeyFolder, utils.AnnoKeyMessage)

func TestPolicyToStore(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		want        map[string]string
	}{
		{
			name: "keeps manager and source properties",
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     "repo",
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/a.json",
			},
			want: map[string]string{
				utils.AnnoKeyManagerKind:     "repo",
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/a.json",
			},
		},
		{
			name: "drops every derived annotation",
			annotations: map[string]string{
				utils.AnnoKeyUpdatedTimestamp: "2026-01-01T00:00:00Z",
				utils.AnnoKeyFolder:           "some-folder",
				utils.AnnoKeyMessage:          "a commit message",
				utils.AnnoKeyManagerKind:      "repo",
			},
			want: map[string]string{utils.AnnoKeyManagerKind: "repo"},
		},
		{
			name:        "keeps an annotation the policy has never heard of",
			annotations: map[string]string{"example.com/thing": "value"},
			want:        map[string]string{"example.com/thing": "value"},
		},
		{
			name:        "nil rather than an empty map when only derived keys are present",
			annotations: map[string]string{utils.AnnoKeyFolder: "some-folder"},
		},
		{
			name: "nil for an object with no annotations",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &metav1.ObjectMeta{Annotations: tt.annotations}
			require.Equal(t, tt.want, dashboardLike.ToStore(obj))
		})
	}
}

func TestPolicyApply(t *testing.T) {
	t.Run("a stored copy never wins over the column it mirrors", func(t *testing.T) {
		obj := &metav1.ObjectMeta{Annotations: map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "from-the-column",
			utils.AnnoKeyFolder:           "from-the-column",
		}}

		dashboardLike.Apply(obj, map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "stale",
			utils.AnnoKeyFolder:           "stale",
			utils.AnnoKeyManagerKind:      "repo",
		})

		require.Equal(t, map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "from-the-column",
			utils.AnnoKeyFolder:           "from-the-column",
			utils.AnnoKeyManagerKind:      "repo",
		}, obj.Annotations)
	})

	t.Run("nothing stored leaves the object alone", func(t *testing.T) {
		obj := &metav1.ObjectMeta{}
		dashboardLike.Apply(obj, nil)
		require.Nil(t, obj.Annotations)
	})

	t.Run("round trips through ToStore", func(t *testing.T) {
		stored := map[string]string{
			utils.AnnoKeyManagerKind:     "repo",
			utils.AnnoKeyManagerIdentity: "my-repo",
			utils.AnnoKeySourcePath:      "dashboards/a.json",
		}
		obj := &metav1.ObjectMeta{}
		dashboardLike.Apply(obj, stored)
		require.Equal(t, stored, dashboardLike.ToStore(obj))
	})
}

func TestPolicyDropping(t *testing.T) {
	policy := dashboardLike.Dropping(utils.AnnoKeyKubectlLastAppliedConfig)

	obj := &metav1.ObjectMeta{Annotations: map[string]string{
		utils.AnnoKeyKubectlLastAppliedConfig: `{"secure":{"password":{"create":"hunter2"}}}`,
		utils.AnnoKeyManagerKind:              "repo",
	}}

	t.Run("a dropped annotation is never stored", func(t *testing.T) {
		require.Equal(t, map[string]string{utils.AnnoKeyManagerKind: "repo"}, policy.ToStore(obj))
	})

	t.Run("and does not come back from a row that already has one", func(t *testing.T) {
		// Rows written before the key was dropped must not replay it onto a read.
		out := &metav1.ObjectMeta{}
		policy.Apply(out, map[string]string{
			utils.AnnoKeyKubectlLastAppliedConfig: `{"secure":{"password":{"create":"hunter2"}}}`,
			utils.AnnoKeyManagerKind:              "repo",
		})
		require.Equal(t, map[string]string{utils.AnnoKeyManagerKind: "repo"}, out.Annotations)
	})

	t.Run("the policy it was derived from is unchanged", func(t *testing.T) {
		require.Contains(t, dashboardLike.ToStore(obj), utils.AnnoKeyKubectlLastAppliedConfig)
	})
}
