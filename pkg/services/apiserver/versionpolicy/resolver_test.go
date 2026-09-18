package versionpolicy

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolverResolve(t *testing.T) {
	order := map[string][]string{"foo.grafana.app": {"v2", "v1", "v1beta1"}}

	tests := []struct {
		name     string
		defaults map[string]VersionPolicy
		ini      map[string]VersionPolicy
		resource map[string]VersionPolicy
		want     map[string]VersionPolicy
	}{
		{
			name: "resource wins over ini wins over default, both fields",
			defaults: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1", MaxAllowedVersion: "v1"},
			},
			ini: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1beta1", MaxAllowedVersion: "v1beta1"},
			},
			resource: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v2", MaxAllowedVersion: "v2"},
			},
			want: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v2", MaxAllowedVersion: "v2"},
			},
		},
		{
			name: "per-field independence: resource sets max only, preferred falls through to ini",
			defaults: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1"},
			},
			ini: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1beta1"},
			},
			resource: map[string]VersionPolicy{
				"foo.grafana.app": {MaxAllowedVersion: "v2"},
			},
			want: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1beta1", MaxAllowedVersion: "v2"},
			},
		},
		{
			name: "only default sets a field; other field absent everywhere",
			defaults: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1"},
			},
			ini:      map[string]VersionPolicy{},
			resource: map[string]VersionPolicy{},
			want: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1"},
			},
		},
		{
			name:     "all layers absent for every group yields an empty result",
			defaults: map[string]VersionPolicy{},
			ini:      map[string]VersionPolicy{},
			resource: map[string]VersionPolicy{},
			want:     map[string]VersionPolicy{},
		},
		{
			name: "unknown version at the resource layer is ignored, falls through to ini",
			defaults: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1"},
			},
			ini: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1beta1"},
			},
			resource: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v99"},
			},
			want: map[string]VersionPolicy{
				"foo.grafana.app": {PreferredVersion: "v1beta1"},
			},
		},
		{
			name: "unknown version at every layer for a field leaves it empty",
			defaults: map[string]VersionPolicy{
				"foo.grafana.app": {MaxAllowedVersion: "v97"},
			},
			ini: map[string]VersionPolicy{
				"foo.grafana.app": {MaxAllowedVersion: "v98"},
			},
			resource: map[string]VersionPolicy{
				"foo.grafana.app": {MaxAllowedVersion: "v99"},
			},
			want: map[string]VersionPolicy{},
		},
		{
			name: "unregistered group (empty priority slice) is treated as all-unknown",
			defaults: map[string]VersionPolicy{
				"unknown.grafana.app": {PreferredVersion: "v1"},
			},
			ini:      map[string]VersionPolicy{},
			resource: map[string]VersionPolicy{},
			want:     map[string]VersionPolicy{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := NewResolver(order)
			got := r.Resolve(tt.defaults, tt.ini, tt.resource)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResolverOutranks(t *testing.T) {
	order := map[string][]string{"foo.grafana.app": {"v2", "v1", "v1beta1"}}
	r := NewResolver(order)

	assert.True(t, r.Outranks("foo.grafana.app", "v2", "v1beta1"), "v2 should outrank v1beta1")
	assert.False(t, r.Outranks("foo.grafana.app", "v1beta1", "v2"), "v1beta1 should not outrank v2")
	assert.False(t, r.Outranks("foo.grafana.app", "v1", "v1"), "a version does not outrank itself")
	assert.False(t, r.Outranks("foo.grafana.app", "v2", "v99"), "unregistered version never outranks or is outranked")
	assert.False(t, r.Outranks("unknown.grafana.app", "v1", "v2"), "unregistered group never ranks")
}

func TestResolverOutranksMajorFirst(t *testing.T) {
	// Registered set spanning two majors and all stages.
	order := map[string][]string{"g": {"v2", "v2beta1", "v2alpha1", "v1", "v1beta1", "v1alpha1", "v0alpha1"}}
	r := NewResolver(order)
	o := func(a, b string) bool { return r.Outranks("g", a, b) }

	// Higher major always outranks, regardless of stage — a v1 cap must reject the whole v2 line.
	assert.True(t, o("v2", "v1"))
	assert.True(t, o("v2beta1", "v1"), "v2beta1 outranks v1 (higher major)")
	assert.True(t, o("v2alpha1", "v1"), "v2alpha1 outranks v1 (higher major)")

	// Lower major stays below the cap.
	assert.False(t, o("v0alpha1", "v1"), "v0alpha1 is below a v1 cap")
	assert.False(t, o("v1beta1", "v1"), "v1beta1 (pre-release of same major) is below v1")
	assert.False(t, o("v1alpha1", "v1"))

	// Within a major: ga > beta > alpha, then stage number.
	assert.True(t, o("v1", "v1beta1"))
	assert.True(t, o("v2beta1", "v2alpha1"))
	assert.False(t, o("v1", "v1"), "a version does not outrank itself")
}
