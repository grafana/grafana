package libraryelements

import (
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyCreateCommandToUnstructured(cmd model.CreateLibraryElementCommand) (unstructured.Unstructured, error) {
	// library variables are not a valid element kind.
	if cmd.Kind != 1 {
		return unstructured.Unstructured{}, model.ErrLibraryElementUnSupportedElementKind
	}

	var modelData map[string]interface{}
	if err := json.Unmarshal(cmd.Model, &modelData); err != nil {
		return unstructured.Unstructured{}, fmt.Errorf("failed to unmarshal model: %w", err)
	}
	modelData["title"] = cmd.Name

	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": modelData,
		},
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	obj.SetName(uid)
	obj.SetNamespace("default") // TODO: hack

	meta, err := utils.MetaAccessor(&obj)
	if err != nil {
		return obj, err
	}
	if cmd.FolderUID != nil {
		meta.SetFolder(*cmd.FolderUID)
	}

	return obj, nil
}

func LegacyPatchCommandToUnstructured(cmd model.PatchLibraryElementCommand) (unstructured.Unstructured, error) {
	var modelData map[string]interface{}
	if cmd.Model != nil {
		if err := json.Unmarshal(cmd.Model, &modelData); err != nil {
			return unstructured.Unstructured{}, fmt.Errorf("failed to unmarshal model: %w", err)
		}
	} else {
		modelData = make(map[string]interface{})
	}
	modelData["title"] = cmd.Name

	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": modelData,
		},
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	obj.SetName(uid)

	// TODO: folder moving?

	return obj, nil
}

func UnstructuredToLegacyLibraryPanelDTO(item unstructured.Unstructured) (*model.LibraryElementDTO, error) {
	spec, exists := item.Object["spec"].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("spec not found in unstructured object")
	}

	modelJSON, err := json.Marshal(spec)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	description, _ := spec["description"].(string)
	name, _ := spec["title"].(string)
	panelType, _ := spec["type"].(string)

	dto := &model.LibraryElementDTO{
		// TODO: orgID
		UID:         item.GetName(),
		Name:        name,
		Kind:        int64(model.PanelElement),
		Type:        panelType,
		Description: description,
		Model:       modelJSON,
		// TODO: Version
		// TODO: Meta
		/*
			type LibraryElementDTOMeta struct {
				FolderName          string `json:"folderName"` // note: use "General" if not set
				FolderUID           string `json:"folderUid"`
				ConnectedDashboards int64  `json:"connectedDashboards"`

				Created time.Time `json:"created"`
				Updated time.Time `json:"updated"`

				CreatedBy librarypanel.LibraryElementDTOMetaUser `json:"createdBy"`
				UpdatedBy librarypanel.LibraryElementDTOMetaUser `json:"updatedBy"`
			}
		*/
		// TODO: SchemaVersion
	}

	meta, err := utils.MetaAccessor(&item)
	if err == nil {
		dto.ID = meta.GetDeprecatedInternalID() // nolint:staticcheck
		// TODO: is folderID needed?
		folderUID := meta.GetFolder()
		if folderUID != "" {
			dto.FolderUID = folderUID
		}
	}

	return dto, nil
}

func ConvertToK8sResource(dto *model.LibraryElementDTO, namespacer request.NamespaceMapper) (*dashboardV0.LibraryPanel, error) {
	var modelData map[string]interface{}
	if err := json.Unmarshal(dto.Model, &modelData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal model: %w", err)
	}

	spec := dashboardV0.LibraryPanelSpec{
		Type:          dto.Type,
		PluginVersion: modelData["pluginVersion"].(string),
		Title:         dto.Name,
		Description:   dto.Description,
		Options:       common.Unstructured{Object: modelData["options"].(map[string]interface{})},
		FieldConfig:   common.Unstructured{Object: modelData["fieldConfig"].(map[string]interface{})},
		//Datasource:    modelData["datasource"].(string),
		//Targets:       modelData["targets"].([]interface{}),
	}

	panel := &dashboardV0.LibraryPanel{
		ObjectMeta: metav1.ObjectMeta{
			Name:      dto.UID,
			Namespace: namespacer(dto.OrgID),
		},
		Spec: spec,
	}

	// TODO: created at, created by, etc
	meta, err := utils.MetaAccessor(panel)
	if err == nil {
		if dto.ID > 0 {
			meta.SetDeprecatedInternalID(dto.ID) // nolint:staticcheck
		}
		if dto.FolderUID != "" {
			meta.SetFolder(dto.FolderUID)
		}
		meta.SetGeneration(dto.Version)
	}

	return panel, nil
}

func ConvertToLegacyCreateCommand(panel *dashboardV0.LibraryPanel, orgID int64) (*model.CreateLibraryElementCommand, error) {
	modelData := map[string]interface{}{
		"type":          panel.Spec.Type,
		"title":         panel.Spec.Title,
		"description":   panel.Spec.Description,
		"options":       panel.Spec.Options.Object,
		"fieldConfig":   panel.Spec.FieldConfig.Object,
		"pluginVersion": panel.Spec.PluginVersion,
		"targets":       panel.Spec.Targets,
		"datasource":    panel.Spec.Datasource,
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	cmd := &model.CreateLibraryElementCommand{
		Name:  panel.Spec.Title,
		Model: modelJSON,
		Kind:  int64(model.PanelElement),
		UID:   panel.Name,
	}

	meta, err := utils.MetaAccessor(panel)
	if err == nil {
		folderUID := meta.GetFolder()
		if folderUID != "" {
			cmd.FolderUID = &folderUID
		}
	}

	return cmd, nil
}

func ConvertToLegacyPatchCommand(panel *dashboardV0.LibraryPanel, orgID int64, version int64) (*model.PatchLibraryElementCommand, error) {
	modelData := map[string]interface{}{
		"type":          panel.Spec.Type,
		"title":         panel.Spec.Title,
		"description":   panel.Spec.Description,
		"options":       panel.Spec.Options.Object,
		"fieldConfig":   panel.Spec.FieldConfig.Object,
		"pluginVersion": panel.Spec.PluginVersion,
		"targets":       panel.Spec.Targets,
		"datasource":    panel.Spec.Datasource,
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	cmd := &model.PatchLibraryElementCommand{
		UID:     panel.Name,
		Name:    panel.Spec.Title,
		Model:   modelJSON,
		Kind:    int64(model.PanelElement),
		Version: version,
	}

	meta, err := utils.MetaAccessor(panel)
	if err == nil {
		folderUID := meta.GetFolder()
		if folderUID != "" {
			cmd.FolderUID = &folderUID
		}
	}

	return cmd, nil
}
