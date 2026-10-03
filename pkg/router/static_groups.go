package router

import (
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/setting"
)

// staticGroupEntry is one entry of the static_groups JSON array. Name must
// match the RouteBackend CR's own metadata.name, the same key combineByName
// uses to correlate against manifestMap and coreGroupsWithoutManifests.
type staticGroupEntry struct {
	Name             string   `json:"name"`
	Group            string   `json:"group"`
	Versions         []string `json:"versions"`
	PreferredVersion string   `json:"preferredVersion"`
}

// parseStaticGroups reads the cloud_router section's static_groups key: a
// JSON array of {name,group,versions,preferredVersion} entries. This is the
// last-resort fallback combineByName consults when a RouteBackend's group has
// neither a live AppManifest CR nor a compiled-in manifest (see
// coreGroupsWithoutManifests) -- a stopgap for apps deployed outside this
// binary whose manifest the router has no other way to learn, until they get
// a real AppManifest CR or a RegisterAppManifest registration.
//
// An unset or empty key returns a nil map and no error, matching
// parseAggregateTargets' "nothing configured" behavior.
func parseStaticGroups(section *setting.DynamicSection) (map[string]metav1.APIGroup, error) {
	raw := section.Key("static_groups").MustString("")
	if raw == "" {
		return nil, nil
	}

	var entries []staticGroupEntry
	if err := json.Unmarshal([]byte(raw), &entries); err != nil {
		return nil, fmt.Errorf("static_groups: invalid JSON: %w", err)
	}

	groups := make(map[string]metav1.APIGroup, len(entries))
	for i, e := range entries {
		if e.Name == "" {
			return nil, fmt.Errorf("static_groups[%d]: name is required", i)
		}
		if e.Group == "" {
			return nil, fmt.Errorf("static_groups[%d] (%s): group is required", i, e.Name)
		}
		if len(e.Versions) == 0 {
			return nil, fmt.Errorf("static_groups[%d] (%s): versions is required", i, e.Name)
		}
		if _, exists := groups[e.Name]; exists {
			return nil, fmt.Errorf("static_groups: duplicate name %q", e.Name)
		}

		preferred := e.PreferredVersion
		if preferred == "" {
			preferred = e.Versions[len(e.Versions)-1]
		}

		apiGroup := metav1.APIGroup{Name: e.Group}
		for _, v := range e.Versions {
			apiGroup.Versions = append(apiGroup.Versions, metav1.GroupVersionForDiscovery{
				GroupVersion: e.Group + "/" + v,
				Version:      v,
			})
		}
		apiGroup.PreferredVersion = metav1.GroupVersionForDiscovery{
			GroupVersion: e.Group + "/" + preferred,
			Version:      preferred,
		}

		groups[e.Name] = apiGroup
	}

	return groups, nil
}
