package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestIsIdleDraft(t *testing.T) {
	now := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
	cutoff := now.Add(-30 * 24 * time.Hour)
	item := func(lifecycle string, created, updated time.Time) *unstructured.Unstructured {
		u := &unstructured.Unstructured{Object: map[string]any{}}
		u.SetCreationTimestamp(metaTime(created))
		if lifecycle != "" {
			u.SetLabels(map[string]string{utils.LabelKeyLifecycle: lifecycle})
		}
		if !updated.IsZero() {
			u.SetAnnotations(map[string]string{utils.AnnoKeyUpdatedTimestamp: updated.Format(time.RFC3339)})
		}
		return u
	}
	old := now.Add(-40 * 24 * time.Hour)
	recent := now.Add(-2 * 24 * time.Hour)

	require.True(t, isIdleDraft(item(utils.LifecycleDraft, old, time.Time{}), cutoff))
	require.True(t, isIdleDraft(item(utils.LifecycleFork, old, old), cutoff))
	require.False(t, isIdleDraft(item(utils.LifecycleDraft, old, recent), cutoff), "a recent write resets the clock")
	require.False(t, isIdleDraft(item(utils.LifecyclePublished, old, time.Time{}), cutoff), "published dashboards never expire")
	require.False(t, isIdleDraft(item("", old, time.Time{}), cutoff))
}

func metaTime(t time.Time) metav1.Time { return metav1.NewTime(t) }
