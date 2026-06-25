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
		return json.Marshal(obj.Spec)
	}
	return nil, fmt.Errorf("unsupported library panel type: %T", raw)
}

// legacyModelToLibraryPanelSpec is the inverse of the legacyModel reconstruction in
// unstructuredToLegacyLibraryPanelDTO. It builds a LibraryPanelSpec from the legacy
// library panel JSON model and the library panel name.
//
// Note on titles: the legacy model's "title" is the panel title as shown in a dashboard
// (spec.PanelTitle), while the library panel's own name is spec.Title. The model JSON's
// own "title" field would otherwise unmarshal into spec.Title (same json tag), so we
// explicitly move it to PanelTitle and set Title from the supplied name afterwards.
func legacyModelToLibraryPanelSpec(name string, modelJSON json.RawMessage) (v0alpha1.LibraryPanelSpec, error) {
	var spec v0alpha1.LibraryPanelSpec
	if len(modelJSON) > 0 {
		if err := json.Unmarshal(modelJSON, &spec); err != nil {
			return spec, fmt.Errorf("failed to unmarshal library panel model: %w", err)
		}
	}

	// The model's "title" is the in-dashboard panel title, not the library panel name.
	spec.PanelTitle = spec.Title
	// The library panel name is authoritative for spec.Title.
	spec.Title = name

	return spec, nil
}
