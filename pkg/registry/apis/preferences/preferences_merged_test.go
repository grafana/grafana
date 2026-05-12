package preferences

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestMergePreferences(t *testing.T) {
	tests := []struct {
		name     string
		defaults preferences.PreferencesSpec
		items    []preferences.Preferences
		expect   preferences.PreferencesSpec
	}{
		{
			name: "test1",
			defaults: preferences.PreferencesSpec{
				Theme:            new("settings.ini"),
				Language:         new("settings.ini"),
				HomeDashboardUID: new("settings.ini"),
				Timezone:         new("settings.ini"),
				WeekStart:        new("settings.ini"),
			},
			items: []preferences.Preferences{
				{Spec: preferences.PreferencesSpec{
					Theme: new("user"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:    new("teamA"),
					Language: new("teamA"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:            new("teamB"),
					Language:         new("teamB"),
					HomeDashboardUID: new("teamB"),
				}},
				{Spec: preferences.PreferencesSpec{
					Theme:            new("namespace"),
					Language:         new("namespace"),
					HomeDashboardUID: new("namespace"),
					Timezone:         new("namespace"),
				}},
			},
			expect: preferences.PreferencesSpec{
				Theme:            new("user"),
				Language:         new("teamA"),
				HomeDashboardUID: new("teamB"),
				Timezone:         new("namespace"),
				WeekStart:        new("settings.ini"),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			current, err := merge(tt.defaults, tt.items)
			require.NoError(t, err)
			require.Equal(t, tt.expect, current.Spec)
		})
	}
}

func TestMergedResourceVersion(t *testing.T) {
	// Use millisecond precision because the resourceVersion is derived from UnixMilli.
	t0 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	t1 := t0.Add(1 * time.Hour)
	t2 := t0.Add(2 * time.Hour)
	t3 := t0.Add(3 * time.Hour)

	rv := func(t time.Time) string {
		return fmt.Sprintf("%d", t.UnixMilli())
	}

	defaults := preferences.PreferencesSpec{
		Theme: new("settings.ini"),
	}

	t.Run("empty items list yields no resourceVersion", func(t *testing.T) {
		got, err := merge(defaults, nil)
		require.NoError(t, err)
		require.Empty(t, got.ResourceVersion)
		require.True(t, got.CreationTimestamp.IsZero())
	})

	t.Run("uses the most recent CreationTimestamp across items", func(t *testing.T) {
		items := []preferences.Preferences{
			{
				ObjectMeta: v1.ObjectMeta{CreationTimestamp: v1.NewTime(t1)},
				Spec:       preferences.PreferencesSpec{Theme: new("a")},
			},
			{
				ObjectMeta: v1.ObjectMeta{CreationTimestamp: v1.NewTime(t3)},
				Spec:       preferences.PreferencesSpec{Theme: new("b")},
			},
			{
				ObjectMeta: v1.ObjectMeta{CreationTimestamp: v1.NewTime(t2)},
				Spec:       preferences.PreferencesSpec{Theme: new("c")},
			},
		}
		got, err := merge(defaults, items)
		require.NoError(t, err)
		require.Equal(t, rv(t3), got.ResourceVersion)
		require.Equal(t, t3.UnixMilli(), got.CreationTimestamp.UnixMilli())
	})

	t.Run("AnnoKeyUpdatedTimestamp wins over older CreationTimestamp", func(t *testing.T) {
		items := []preferences.Preferences{
			{
				ObjectMeta: v1.ObjectMeta{
					CreationTimestamp: v1.NewTime(t1),
					Annotations: map[string]string{
						utils.AnnoKeyUpdatedTimestamp: t3.Format(time.RFC3339),
					},
				},
				Spec: preferences.PreferencesSpec{Theme: new("a")},
			},
			{
				ObjectMeta: v1.ObjectMeta{CreationTimestamp: v1.NewTime(t2)},
				Spec:       preferences.PreferencesSpec{Theme: new("b")},
			},
		}
		got, err := merge(defaults, items)
		require.NoError(t, err)
		require.Equal(t, rv(t3), got.ResourceVersion)
	})

	t.Run("CreationTimestamp wins over older AnnoKeyUpdatedTimestamp", func(t *testing.T) {
		items := []preferences.Preferences{
			{
				ObjectMeta: v1.ObjectMeta{
					CreationTimestamp: v1.NewTime(t1),
					Annotations: map[string]string{
						utils.AnnoKeyUpdatedTimestamp: t1.Format(time.RFC3339),
					},
				},
				Spec: preferences.PreferencesSpec{Theme: new("a")},
			},
			{
				ObjectMeta: v1.ObjectMeta{CreationTimestamp: v1.NewTime(t3)},
				Spec:       preferences.PreferencesSpec{Theme: new("b")},
			},
		}
		got, err := merge(defaults, items)
		require.NoError(t, err)
		require.Equal(t, rv(t3), got.ResourceVersion)
	})

	t.Run("invalid AnnoKeyUpdatedTimestamp falls back to CreationTimestamp", func(t *testing.T) {
		items := []preferences.Preferences{
			{
				ObjectMeta: v1.ObjectMeta{
					CreationTimestamp: v1.NewTime(t2),
					Annotations: map[string]string{
						utils.AnnoKeyUpdatedTimestamp: "not-a-real-timestamp",
					},
				},
				Spec: preferences.PreferencesSpec{Theme: new("a")},
			},
		}
		got, err := merge(defaults, items)
		require.NoError(t, err)
		require.Equal(t, rv(t2), got.ResourceVersion)
	})
}
