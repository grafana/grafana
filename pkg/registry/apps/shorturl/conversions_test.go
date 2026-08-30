package shorturl

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/services/shorturls"
)

func TestUnstructuredToLegacyShortURL(t *testing.T) {
	tests := []struct {
		name        string
		object      map[string]interface{}
		expectedUID string
		expectPath  string
		expectSeen  int64
		expectErr   bool
	}{
		{
			name: "lastSeenAt as int64 (k8s codec path)",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": "d/foo/bar"},
				"status":   map[string]interface{}{"lastSeenAt": int64(1700000000)},
			},
			expectedUID: "abc123",
			expectPath:  "d/foo/bar",
			expectSeen:  1700000000,
		},
		{
			name: "lastSeenAt as float64 (JSON unmarshal path)",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": "d/foo/bar"},
				"status":   map[string]interface{}{"lastSeenAt": float64(1700000000)},
			},
			expectedUID: "abc123",
			expectPath:  "d/foo/bar",
			expectSeen:  1700000000,
		},
		{
			name: "missing status defaults lastSeenAt to 0",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": "d/foo/bar"},
			},
			expectedUID: "abc123",
			expectPath:  "d/foo/bar",
			expectSeen:  0,
		},
		{
			name: "missing lastSeenAt defaults to 0",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": "d/foo/bar"},
				"status":   map[string]interface{}{},
			},
			expectedUID: "abc123",
			expectPath:  "d/foo/bar",
			expectSeen:  0,
		},
		{
			name: "missing spec returns error",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"status":   map[string]interface{}{"lastSeenAt": int64(1700000000)},
			},
			expectErr: true,
		},
		{
			name: "missing spec.path returns error",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{},
			},
			expectErr: true,
		},
		{
			name: "non-string spec.path returns error",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": 42},
			},
			expectErr: true,
		},
		{
			name: "wrong-type lastSeenAt returns error",
			object: map[string]interface{}{
				"metadata": map[string]interface{}{"name": "abc123"},
				"spec":     map[string]interface{}{"path": "d/foo/bar"},
				"status":   map[string]interface{}{"lastSeenAt": "not-a-number"},
			},
			expectErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			item := unstructured.Unstructured{Object: tc.object}

			// require.NotPanics guards the original bug: conversion must never panic,
			// even when fields are missing or have unexpected types.
			var (
				result *shorturls.ShortUrl
				err    error
			)
			require.NotPanics(t, func() {
				result, err = UnstructuredToLegacyShortURL(item)
			})

			if tc.expectErr {
				require.Error(t, err)
				require.Nil(t, result)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			require.Equal(t, tc.expectedUID, result.Uid)
			require.Equal(t, tc.expectPath, result.Path)
			require.Equal(t, tc.expectSeen, result.LastSeenAt)
		})
	}
}
