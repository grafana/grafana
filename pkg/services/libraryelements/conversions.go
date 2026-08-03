package libraryelements

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util"
)

func ToCreateLibraryElementCommand(raw runtime.Object) (*model.CreateLibraryElementCommand, error) {
	obj, err := utils.MetaAccessor(raw)
	if err != nil {
		return nil, err
	}
	folder := obj.GetFolder()
	cmd := &model.CreateLibraryElementCommand{
		UID:       obj.GetName(),
		FolderUID: &folder,
		Kind:      1, // the only kind... LibraryPanel
		Name:      obj.FindTitle("library panel"),
	}
	if cmd.UID == "" {
		if obj.GetGenerateName() == "" {
			return nil, fmt.Errorf("expecting either name or generateName property")
		}
		cmd.UID = obj.GetGenerateName() + util.GenerateShortUID()
	}
	cmd.Model, err = toRawMessage(raw)
	return cmd, err
}

func ToPatchLibraryElementCommand(raw runtime.Object) (*model.PatchLibraryElementCommand, error) {
	obj, err := utils.MetaAccessor(raw)
	if err != nil {
		return nil, err
	}
	folder := obj.GetFolder()
	cmd := &model.PatchLibraryElementCommand{
		UID:       obj.GetName(),
		FolderUID: &folder,
		Kind:      1, // the only kind... LibraryPanel
		Name:      obj.FindTitle("library panel"),
		// generation mirrors the legacy library element version, so it carries the
		// optimistic-concurrency token through the k8s update path.
		Version: obj.GetGeneration(),
	}
	cmd.Model, err = toRawMessage(raw)
	return cmd, err
}

func toRawMessage(raw runtime.Object) (json.RawMessage, error) {
	switch obj := raw.(type) {
	case *v0alpha1.LibraryPanel:
		return LibraryPanelToLegacyModel(obj)
	}
	return nil, fmt.Errorf("unsupported library panel type: %T", raw)
}

// LibraryPanelToLegacyModel rebuilds the legacy `model` JSON blob (the panel body
// stored in the library_element table) from a k8s LibraryPanel. It is the inverse
// of LegacyModelToLibraryPanel: properties that have no typed field on
// LibraryPanelSpec travel in status.missing, so they are used as the base of the
// model to keep unknown panel keys (e.g. transformations) intact across the
// k8s <-> legacy round trip.
func LibraryPanelToLegacyModel(panel *v0alpha1.LibraryPanel) (json.RawMessage, error) {
	legacyModel := map[string]any{}
	if panel.Status != nil {
		for k, v := range panel.Status.Missing.Object {
			legacyModel[k] = v
		}
	}

	spec := panel.Spec
	legacyModel["type"] = spec.Type
	// in the legacy model blob, "title" is the title of the panel as displayed in
	// dashboards, while the library panel name lives in the SQL column / spec.title.
	legacyModel["title"] = spec.PanelTitle
	if spec.PluginVersion != "" {
		legacyModel["pluginVersion"] = spec.PluginVersion
	}
	if spec.Description != "" {
		legacyModel["description"] = spec.Description
	}
	options := spec.Options.Object
	if options == nil {
		options = map[string]any{}
	}
	legacyModel["options"] = options
	fieldConfig := spec.FieldConfig.Object
	if fieldConfig == nil {
		fieldConfig = map[string]any{}
	}
	legacyModel["fieldConfig"] = fieldConfig
	if spec.GridPos != (v0alpha1.GridPos{}) {
		legacyModel["gridPos"] = spec.GridPos
	}
	if spec.Datasource != nil {
		legacyModel["datasource"] = spec.Datasource
	}
	if len(spec.Targets) > 0 {
		legacyModel["targets"] = spec.Targets
	}
	if len(spec.Links) > 0 {
		legacyModel["links"] = spec.Links
	}
	if spec.Transparent {
		legacyModel["transparent"] = spec.Transparent
	}

	return json.Marshal(legacyModel)
}

// libraryPanelSpecKeys are the legacy model properties that map to typed fields on
// LibraryPanelSpec. Everything else is preserved in status.missing.
var libraryPanelSpecKeys = []string{"type", "pluginVersion", "title", "description", "options", "fieldConfig", "datasource", "targets", "links", "transparent", "libraryPanel", "id", "gridPos"}

// LegacyModelToLibraryPanel builds the spec and status of a k8s LibraryPanel from a
// legacy `model` JSON blob and the library panel name (the SQL name column). Model
// properties without a typed spec field are kept in status.missing.
func LegacyModelToLibraryPanel(name string, legacyModel json.RawMessage) (v0alpha1.LibraryPanelSpec, *v0alpha1.LibraryPanelStatus, error) {
	spec := v0alpha1.LibraryPanelSpec{}
	status := &v0alpha1.LibraryPanelStatus{}
	if err := json.Unmarshal(legacyModel, &spec); err != nil {
		return spec, status, fmt.Errorf("invalid library panel model: %w", err)
	}
	if err := json.Unmarshal(legacyModel, &status.Missing.Object); err != nil {
		return spec, status, fmt.Errorf("invalid library panel model: %w", err)
	}

	// the panel title used in dashboards and title of the library panel can differ
	// in the old model blob, the panel title is specified as "title", and the library panel title is
	// in "libraryPanel.name", or as the column in the db.
	spec.PanelTitle = spec.Title
	spec.Title = name

	for _, k := range libraryPanelSpecKeys {
		delete(status.Missing.Object, k)
	}

	return spec, status, nil
}
