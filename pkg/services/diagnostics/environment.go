package diagnostics

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

// environmentArtifactVersion is stamped into every environment.json so a reader can tell how to
// interpret the artifact.
const environmentArtifactVersion = 1

// Environment is environment.json, which describes the Grafana build and the plugins that were installed.
// One per bundle, not one per panel: Grafana runs a single version of a plugin per install (see
// pluginstore.Store.Plugin), so per-panel copies would all be identical.
type Environment struct {
	Version     int                      `json:"version"`
	Grafana     GrafanaBuild             `json:"grafana"`
	Plugins     map[string]PluginVersion `json:"plugins,omitempty"`
	Datasources map[string]string        `json:"datasources,omitempty"`
}

// GrafanaBuild identifies the Grafana build that produced the bundle.
type GrafanaBuild struct {
	// Version and Edition are emitted even when empty: an absent key is indistinguishable from an
	// older schema that lacked it. Version comes from ldflags, so a build without them has none.
	Version          string `json:"version"`
	Edition          string `json:"edition"`
	Commit           string `json:"commit,omitempty"`
	EnterpriseCommit string `json:"enterpriseCommit,omitempty"`
	Branch           string `json:"branch,omitempty"`
	BuildStamp       int64  `json:"buildStamp,omitempty"`
	Packaging        string `json:"packaging,omitempty"`
	Env              string `json:"env,omitempty"`
}

// PluginVersion is one referenced plugin's installed version and provenance.
type PluginVersion struct {
	Type string `json:"type,omitempty"`
	// Empty for core plugins, which declare no version of their own.
	Version       string `json:"version"`
	Class         string `json:"class,omitempty"`
	Backend       bool   `json:"backend,omitempty"`
	Signature     string `json:"signature,omitempty"`
	SignatureType string `json:"signatureType,omitempty"`
	SignatureOrg  string `json:"signatureOrg,omitempty"`
	Error         string `json:"error,omitempty"`
	// Set when a panel references a plugin the instance doesn't have.
	NotInstalled bool `json:"notInstalled,omitempty"`
}

// EnvironmentRefs is the set of plugins one bundle touches, filled by the caller from the query and
// panel JSON it already holds.
type EnvironmentRefs struct {
	DatasourcesByUID map[string]string
	PanelPluginIDs   []string
}

// AddPanelPluginID records a viz plugin ID, ignoring blanks and duplicates.
func (r *EnvironmentRefs) AddPanelPluginID(id string) {
	if id == "" {
		return
	}
	for _, existing := range r.PanelPluginIDs {
		if existing == id {
			return
		}
	}
	r.PanelPluginIDs = append(r.PanelPluginIDs, id)
}

// AddDatasource records a datasource reference. A UID whose type is unknown is still recorded, so
// the reader sees the panel referenced it.
func (r *EnvironmentRefs) AddDatasource(uid, pluginID string) {
	if uid == "" {
		return
	}
	if r.DatasourcesByUID == nil {
		r.DatasourcesByUID = map[string]string{}
	}
	// A later query's blank type must not overwrite a resolved one.
	if existing, ok := r.DatasourcesByUID[uid]; ok && existing != "" {
		return
	}
	r.DatasourcesByUID[uid] = pluginID
}

// Merge folds another panel's references into r, so a whole-dashboard caller can accumulate one set
// across panels.
func (r *EnvironmentRefs) Merge(other EnvironmentRefs) {
	for uid, pluginID := range other.DatasourcesByUID {
		r.AddDatasource(uid, pluginID)
	}
	for _, id := range other.PanelPluginIDs {
		r.AddPanelPluginID(id)
	}
}

// PluginIDs returns every referenced plugin ID, deduplicated and sorted for deterministic output.
func (r EnvironmentRefs) PluginIDs() []string {
	seen := map[string]bool{}
	ids := make([]string, 0, len(r.DatasourcesByUID)+len(r.PanelPluginIDs))
	for _, id := range r.DatasourcesByUID {
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	for _, id := range r.PanelPluginIDs {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids
}

// PluginVersionSource is the slice of pluginstore.Store CollectEnvironment needs, narrowed so tests
// need no plugin registry.
type PluginVersionSource interface {
	Plugin(ctx context.Context, pluginID string) (pluginstore.Plugin, bool)
}

// CollectEnvironment snapshots the Grafana build and the installed versions of the plugins in refs.
// Returns nil when cfg is nil, so the bundle omits the artifact rather than carrying an empty build.
// Nil also for plugin IDs without versions.
func CollectEnvironment(ctx context.Context, cfg *setting.Cfg, store PluginVersionSource, refs EnvironmentRefs) *Environment {
	if cfg == nil {
		return nil
	}

	// Edition describes the binary, so it comes from the build flag rather than the licensing service.
	edition := "Open Source"
	if cfg.IsEnterprise {
		edition = "Enterprise"
	}

	// An OSS build sets this to the "NA" placeholder
	enterpriseCommit := cfg.EnterpriseBuildCommit
	if enterpriseCommit == "NA" {
		enterpriseCommit = ""
	}

	env := &Environment{
		Version: environmentArtifactVersion,
		Grafana: GrafanaBuild{
			Version:          cfg.BuildVersion,
			Commit:           cfg.BuildCommit,
			EnterpriseCommit: enterpriseCommit,
			Branch:           cfg.BuildBranch,
			BuildStamp:       cfg.BuildStamp,
			Edition:          edition,
			Packaging:        cfg.Packaging,
			Env:              cfg.Env,
		},
	}

	if len(refs.DatasourcesByUID) > 0 {
		env.Datasources = make(map[string]string, len(refs.DatasourcesByUID))
		for uid, pluginID := range refs.DatasourcesByUID {
			env.Datasources[uid] = pluginID
		}
	}

	pluginIDs := refs.PluginIDs()
	if len(pluginIDs) == 0 {
		return env
	}
	env.Plugins = make(map[string]PluginVersion, len(pluginIDs))
	for _, id := range pluginIDs {
		if store == nil {
			env.Plugins[id] = PluginVersion{}
			continue
		}
		p, exists := store.Plugin(ctx, id)
		if !exists {
			env.Plugins[id] = PluginVersion{NotInstalled: true}
			continue
		}
		entry := PluginVersion{
			Type:          string(p.Type),
			Version:       p.Info.Version,
			Class:         string(p.Class),
			Backend:       p.Backend,
			Signature:     string(p.Signature),
			SignatureType: string(p.SignatureType),
			SignatureOrg:  p.SignatureOrg,
		}
		if p.Error != nil {
			// Bounded: the text is plugin-authored and this artifact is otherwise fixed-size.
			entry.Error = truncateDiagnosticString(p.Error.Error(), 1024)
		}
		env.Plugins[id] = entry
	}
	return env
}

// PanelPluginID returns the viz plugin ID (table, timeseries, etc.) of a panel.
// It handles both v1 and v2 panel types (see indexPanelJSON).
func PanelPluginID(panelJSON json.RawMessage) string {
	if len(panelJSON) == 0 {
		return ""
	}
	var doc struct {
		Kind string `json:"kind"`
		Type string `json:"type"`
		Spec struct {
			VizConfig struct {
				Kind  string `json:"kind"`
				Group string `json:"group"`
			} `json:"vizConfig"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(panelJSON, &doc); err != nil {
		return ""
	}
	// A library panel names no viz plugin in either v1 or v2 save model; v1 writes this sentinel type
	// in its place (see transformSceneToSaveModel.ts).
	if doc.Kind == "LibraryPanel" || doc.Type == "library-panel-ref" {
		return ""
	}
	if doc.Kind == "Panel" {
		if group := doc.Spec.VizConfig.Group; group != "" {
			return group
		}
		if kind := doc.Spec.VizConfig.Kind; kind != "" && kind != "VizConfig" {
			return kind
		}
		return ""
	}
	return doc.Type
}

// PanelPluginIDs returns each panel's viz plugin ID by panel id, for a caller holding a v1 or v2
// dashboard save model but no inline panel JSON.
func PanelPluginIDs(dashboardJSON json.RawMessage) map[int64]string {
	byID := map[int64]string{}
	for id, raw := range indexPanelJSON(dashboardJSON) {
		if pluginID := PanelPluginID(raw); pluginID != "" {
			byID[id] = pluginID
		}
	}
	return byID
}
