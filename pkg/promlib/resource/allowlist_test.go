package resource

import "testing"

func TestIsAllowedResourcePath(t *testing.T) {
	allowed := []string{
		"api/v1/query",
		"/api/v1/query",
		"api/v1/query_range",
		"api/v1/query_exemplars",
		"api/v1/series",
		"api/v1/labels",
		"api/v1/label/instance/values",
		"api/v1/label/__name__/values",
		"api/v1/metadata",
		"api/v1/rules",
		"api/v1/status/buildinfo",
	}
	for _, path := range allowed {
		t.Run(path, func(t *testing.T) {
			if !isAllowedResourcePath(path) {
				t.Errorf("expected %q to be allowed", path)
			}
		})
	}

	rejected := []string{
		"",
		"/",
		"-/reload",
		"-/quit",
		"federate",
		"api/v1/admin/tsdb/delete_series",
		"api/v1/label//values",
		"api/v1/label/foo/bar/values",
		// dot-segments that path.Join would otherwise resolve, potentially
		// escaping a base URL sub-path used for isolation.
		"api/v1/../admin",
		"api/v1/label/../../-/reload/values",
		"./api/v1/labels",
		// double-encoded escapes.
		"api%2Fv1%2Flabels",
		"api/v1/labels%2F..%2F..%2F-%2Freload",
	}
	for _, path := range rejected {
		t.Run(path, func(t *testing.T) {
			if isAllowedResourcePath(path) {
				t.Errorf("expected %q to be rejected", path)
			}
		})
	}
}
