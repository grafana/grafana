package resource

import (
	"fmt"
	"slices"
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
)

var (
	registeredManifestsMu sync.Mutex
	registeredManifests   []*app.ManifestData
	// Set by the first AppManifests call. A manifest registered after that point
	// would be missing from whatever was already built from the earlier result.
	manifestsRead bool
)

// RegisterAppManifest adds a manifest to the set AppManifests returns.
//
// The generated list only covers apps under apps/ in this repository. A
// distribution that compiles in an app of its own has no other way to reach
// every consumer of AppManifests, and seeding the search-field registry
// directly does not work: any later rebuild replaces the registry from
// AppManifests and drops the app's kinds.
//
// Call this from an init function, before anything reads AppManifests. If the
// app later moves under apps/, the generated list covers it and the
// registration has to go away in the same change, or startup panics on the
// duplicate group.
//
// A manifest served by the live manifest source takes precedence over a
// registered one for the kinds it declares, see MergeManifestsByKind.
//
// It panics on a manifest without a group, or on a group that is already
// registered or already in the generated list: two manifests claiming one group
// is a wiring mistake, and search fields would then depend on which one the
// merge happens to pick. It also panics once AppManifests has been read, since
// the manifest would then be missing from everything built before it.
func RegisterAppManifest(m *app.ManifestData) {
	if m == nil || m.Group == "" {
		panic("RegisterAppManifest: manifest is nil or has no group")
	}

	registeredManifestsMu.Lock()
	defer registeredManifestsMu.Unlock()

	if manifestsRead {
		panic(fmt.Sprintf("RegisterAppManifest: group %q registered after AppManifests was read; register it from an init function", m.Group))
	}

	hasGroup := func(other *app.ManifestData) bool { return other != nil && other.Group == m.Group }
	if slices.ContainsFunc(generatedAppManifests(), hasGroup) || slices.ContainsFunc(registeredManifests, hasGroup) {
		panic(fmt.Sprintf("RegisterAppManifest: group %q is already registered", m.Group))
	}

	registeredManifests = append(registeredManifests, m)
}

// AppManifests returns every app manifest compiled into this binary: the
// generated list plus anything passed to RegisterAppManifest.
func AppManifests() []*app.ManifestData {
	registeredManifestsMu.Lock()
	defer registeredManifestsMu.Unlock()
	manifestsRead = true
	return slices.Concat(generatedAppManifests(), registeredManifests)
}
