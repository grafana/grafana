package resource

import (
	"slices"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// watchMetadataSpec lists what a resource's notifications carry beyond identity:
// the allowlisted label and annotation keys and finalizers, plus generation and
// the creation and deletion timestamps. Only allowlisted values are sent, to keep
// the payload small.
type watchMetadataSpec struct {
	Labels      []string
	Annotations []string
	Finalizers  []string
}

// watchNotificationSpecs holds the resources whose notifications carry metadata.
// Resources not listed here send none; add an entry when a consumer needs it.
var watchNotificationSpecs = map[schema.GroupResource]watchMetadataSpec{
	{Group: "setting.grafana.app", Resource: "settings"}: {
		Labels:      []string{"encrypted", "secureValueName"},
		Annotations: []string{"setting.grafana.app/pending-secret-cleanup"},
		Finalizers:  []string{"setting.grafana.app/secret-cleanup"},
	},
}

// newWatchMetadata returns the notification metadata for a write of the given
// resource, or nil when the resource has no entry in watchNotificationSpecs.
func newWatchMetadata(gr schema.GroupResource, obj utils.GrafanaMetaAccessor) *resourcepb.NotificationMetadata {
	spec, ok := watchNotificationSpecs[gr]
	if !ok {
		return nil
	}
	return buildWatchMetadata(spec, obj)
}

// buildWatchMetadata extracts the metadata spec allows from obj, or nil when obj is nil.
func buildWatchMetadata(spec watchMetadataSpec, obj utils.GrafanaMetaAccessor) *resourcepb.NotificationMetadata {
	if obj == nil {
		return nil
	}
	m := &resourcepb.NotificationMetadata{
		Labels:                  filterKeys(obj.GetLabels(), spec.Labels),
		Annotations:             filterKeys(obj.GetAnnotations(), spec.Annotations),
		Finalizers:              filterFinalizers(obj.GetFinalizers(), spec.Finalizers),
		Generation:              obj.GetGeneration(),
		CreationTimestampMillis: timeToMillis(obj.GetCreationTimestamp().Time),
	}
	if dt := obj.GetDeletionTimestamp(); dt != nil {
		m.DeletionTimestampMillis = timeToMillis(dt.Time)
	}
	return m
}

// filterKeys keeps only the allowed keys, or nil when none are set.
func filterKeys(m map[string]string, allowed []string) map[string]string {
	var out map[string]string
	for _, key := range allowed {
		if v, ok := m[key]; ok {
			if out == nil {
				out = make(map[string]string, len(allowed))
			}
			out[key] = v
		}
	}
	return out
}

// filterFinalizers keeps only the allowed finalizers, or nil when none are set.
func filterFinalizers(finalizers, allowed []string) []string {
	var out []string
	for _, f := range finalizers {
		if slices.Contains(allowed, f) {
			if out == nil {
				out = make([]string, 0, len(allowed))
			}
			out = append(out, f)
		}
	}
	return out
}

func timeToMillis(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.UnixMilli()
}
