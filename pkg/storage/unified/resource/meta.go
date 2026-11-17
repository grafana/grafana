package resource

import (
	"fmt"
	"slices"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// WatchMetadataSpec lists what a resource's notifications carry beyond identity:
// the allowlisted label and annotation keys and finalizers, plus generation and
// the creation and deletion timestamps. Only allowlisted values are sent, to keep
// the payload small.
type WatchMetadataSpec struct {
	Labels      []string
	Annotations []string
	Finalizers  []string
}

var (
	watchMetadataSpecsMu sync.RWMutex
	watchMetadataSpecs   = map[schema.GroupResource]WatchMetadataSpec{}
)

// RegisterWatchMetadata sets the metadata the notifications of gr carry. Resources
// that are not registered send none. The owner of a resource registers it, from an
// init function, so nothing here names a specific resource.
//
// It panics on a second registration of the same resource: two owners claiming one
// resource would make what is published depend on init order.
func RegisterWatchMetadata(gr schema.GroupResource, spec WatchMetadataSpec) {
	watchMetadataSpecsMu.Lock()
	defer watchMetadataSpecsMu.Unlock()
	if _, ok := watchMetadataSpecs[gr]; ok {
		panic(fmt.Sprintf("RegisterWatchMetadata: %s is already registered", gr))
	}
	watchMetadataSpecs[gr] = spec
}

// WatchMetadataFor returns the spec registered for gr.
func WatchMetadataFor(gr schema.GroupResource) (WatchMetadataSpec, bool) {
	watchMetadataSpecsMu.RLock()
	defer watchMetadataSpecsMu.RUnlock()
	spec, ok := watchMetadataSpecs[gr]
	return spec, ok
}

// NewWatchMetadata returns the notification metadata for a write of the given
// resource, or nil when no spec is registered for it.
func NewWatchMetadata(gr schema.GroupResource, obj utils.GrafanaMetaAccessor) *resourcepb.NotificationMetadata {
	spec, ok := WatchMetadataFor(gr)
	if !ok {
		return nil
	}
	return buildWatchMetadata(spec, obj)
}

// buildWatchMetadata extracts the metadata spec allows from obj, or nil when obj is nil.
func buildWatchMetadata(spec WatchMetadataSpec, obj utils.GrafanaMetaAccessor) *resourcepb.NotificationMetadata {
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
