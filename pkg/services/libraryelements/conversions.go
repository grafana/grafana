package libraryelements

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util"
)

// LegacyCreateCommandToUnstructured converts a legacy CreateLibraryElementCommand to an unstructured k8s object
func LegacyCreateCommandToUnstructured(cmd model.CreateLibraryElementCommand) (unstructured.Unstructured, error) {
	if cmd.Kind != 1 {
		return unstructured.Unstructured{}, model.ErrLibraryElementUnSupportedElementKind
	}

	var modelData map[string]interface{}
	if err := json.Unmarshal(cmd.Model, &modelData); err != nil {
		return unstructured.Unstructured{}, fmt.Errorf("failed to unmarshal model: %w", err)
	}
	panelType, _ := modelData["type"].(string)
	description, _ := modelData["description"].(string)
	options, _ := modelData["options"].(map[string]interface{})
	pluginVersion, _ := modelData["pluginVersion"].(string)
	targets, _ := modelData["targets"].([]interface{})
	datasource, _ := modelData["datasource"].(map[string]interface{})
	fieldConfig, _ := modelData["fieldConfig"].(map[string]interface{})

	if options == nil {
		options = make(map[string]interface{})
	}
	if fieldConfig == nil {
		fieldConfig = make(map[string]interface{})
	}

	spec := map[string]interface{}{
		"type":        panelType,
		"title":       cmd.Name,
		"description": description,
		"options":     options,
		"fieldConfig": fieldConfig,
	}

	if pluginVersion != "" {
		spec["pluginVersion"] = pluginVersion
	}
	if targets != nil {
		spec["targets"] = targets
	}
	if datasource != nil {
		spec["datasource"] = datasource
	}

	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": spec,
		},
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	obj.SetName(uid)

	// TODO
	//obj.SetFolder(cmd.FolderUID)
	//obj.SetDeprecatedInternalID()

	return obj, nil
}

// LegacyPatchCommandToUnstructured converts a legacy PatchLibraryElementCommand to an unstructured k8s object
func LegacyPatchCommandToUnstructured(cmd model.PatchLibraryElementCommand) (unstructured.Unstructured, error) {
	var modelData map[string]interface{}
	if cmd.Model != nil {
		if err := json.Unmarshal(cmd.Model, &modelData); err != nil {
			return unstructured.Unstructured{}, fmt.Errorf("failed to unmarshal model: %w", err)
		}
	} else {
		modelData = make(map[string]interface{})
	}

	spec := make(map[string]interface{})

	spec["title"] = cmd.Name
	if modelData["type"] != nil {
		spec["type"] = modelData["type"]
	}
	if modelData["description"] != nil {
		spec["description"] = modelData["description"]
	}
	if modelData["options"] != nil {
		spec["options"] = modelData["options"]
	} else {
		spec["options"] = make(map[string]interface{})
	}
	if modelData["fieldConfig"] != nil {
		spec["fieldConfig"] = modelData["fieldConfig"]
	} else {
		spec["fieldConfig"] = make(map[string]interface{})
	}
	if modelData["pluginVersion"] != nil {
		spec["pluginVersion"] = modelData["pluginVersion"]
	}
	if modelData["targets"] != nil {
		spec["targets"] = modelData["targets"]
	}
	if modelData["datasource"] != nil {
		spec["datasource"] = modelData["datasource"]
	}

	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": spec,
		},
	}

	uid := cmd.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	obj.SetName(uid)

	return obj, nil
}

// UnstructuredToLegacyLibraryPanelDTO converts an unstructured k8s object to a legacy LibraryElementDTO
func UnstructuredToLegacyLibraryPanelDTO(item unstructured.Unstructured) (*model.LibraryElementDTO, error) {
	spec, exists := item.Object["spec"].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("spec not found in unstructured object")
	}

	// Reconstruct the model JSON from the spec
	modelData := make(map[string]interface{})

	if spec["type"] != nil {
		modelData["type"] = spec["type"]
	}
	if spec["title"] != nil {
		modelData["title"] = spec["title"]
	}
	if spec["description"] != nil {
		modelData["description"] = spec["description"]
	}
	if spec["options"] != nil {
		modelData["options"] = spec["options"]
	}
	if spec["fieldConfig"] != nil {
		modelData["fieldConfig"] = spec["fieldConfig"]
	}
	if spec["pluginVersion"] != nil {
		modelData["pluginVersion"] = spec["pluginVersion"]
	}
	if spec["targets"] != nil {
		modelData["targets"] = spec["targets"]
	}
	if spec["datasource"] != nil {
		modelData["datasource"] = spec["datasource"]
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	title, _ := spec["title"].(string)
	panelType, _ := spec["type"].(string)
	description, _ := spec["description"].(string)

	dto := &model.LibraryElementDTO{
		UID:         item.GetName(),
		Name:        title,
		Type:        panelType,
		Description: description,
		Model:       modelJSON,
		Kind:        int64(model.PanelElement),
		// TODO
		Version: 1,
	}

	meta, err := utils.MetaAccessor(&item)
	if err == nil {
		dto.ID = meta.GetDeprecatedInternalID() // nolint:staticcheck
	}

	return dto, nil
}

// ConvertToK8sResource converts a legacy LibraryElementDTO to a k8s LibraryPanel resource
func ConvertToK8sResource(dto *model.LibraryElementDTO, namespacer request.NamespaceMapper) (*dashboardV0.LibraryPanel, error) {
	var modelData map[string]interface{}
	if err := json.Unmarshal(dto.Model, &modelData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal model: %w", err)
	}

	spec := dashboardV0.LibraryPanelSpec{
		Type:        dto.Type,
		Title:       dto.Name,
		Description: dto.Description,
	}

	if options, exists := modelData["options"]; exists {
		spec.Options = common.Unstructured{Object: options.(map[string]interface{})}
	} else {
		spec.Options = common.Unstructured{Object: make(map[string]interface{})}
	}

	if fieldConfig, exists := modelData["fieldConfig"]; exists {
		spec.FieldConfig = common.Unstructured{Object: fieldConfig.(map[string]interface{})}
	} else {
		spec.FieldConfig = common.Unstructured{Object: make(map[string]interface{})}
	}

	if pluginVersion, exists := modelData["pluginVersion"].(string); exists {
		spec.PluginVersion = pluginVersion
	}

	createdTime := time.Now()
	if !dto.Meta.Created.IsZero() {
		createdTime = dto.Meta.Created
	}

	panel := &dashboardV0.LibraryPanel{
		ObjectMeta: metav1.ObjectMeta{
			Name:              dto.UID,
			UID:               types.UID(dto.UID),
			ResourceVersion:   strconv.FormatInt(dto.Version, 10),
			CreationTimestamp: metav1.NewTime(createdTime),
			Namespace:         namespacer(dto.OrgID),
		},
		Spec: spec,
	}

	meta, err := utils.MetaAccessor(panel)
	if err == nil {
		if !dto.Meta.Updated.IsZero() {
			meta.SetUpdatedTimestamp(&dto.Meta.Updated)
		}
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

// ConvertToLegacyCreateCommand converts a k8s LibraryPanel to a legacy CreateLibraryElementCommand
func ConvertToLegacyCreateCommand(panel *dashboardV0.LibraryPanel, orgID int64) (*model.CreateLibraryElementCommand, error) {
	spec := panel.Spec
	modelData := map[string]interface{}{
		"type":        spec.Type,
		"title":       spec.Title,
		"description": spec.Description,
		"options":     spec.Options.Object,
		"fieldConfig": spec.FieldConfig.Object,
	}

	if spec.PluginVersion != "" {
		modelData["pluginVersion"] = spec.PluginVersion
	}

	if spec.Targets != nil && len(spec.Targets) > 0 {
		modelData["targets"] = spec.Targets
	}

	if spec.Datasource != nil {
		modelData["datasource"] = spec.Datasource
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	cmd := &model.CreateLibraryElementCommand{
		UID:   panel.Name,
		Name:  spec.Title,
		Model: modelJSON,
		Kind:  int64(model.PanelElement),
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

// ConvertToLegacyPatchCommand converts a k8s LibraryPanel to a legacy PatchLibraryElementCommand
func ConvertToLegacyPatchCommand(panel *dashboardV0.LibraryPanel, orgID int64, version int64) (*model.PatchLibraryElementCommand, error) {
	spec := panel.Spec

	modelData := map[string]interface{}{
		"type":        spec.Type,
		"title":       spec.Title,
		"description": spec.Description,
		"options":     spec.Options.Object,
		"fieldConfig": spec.FieldConfig.Object,
	}

	if spec.PluginVersion != "" {
		modelData["pluginVersion"] = spec.PluginVersion
	}

	if spec.Targets != nil && len(spec.Targets) > 0 {
		modelData["targets"] = spec.Targets
	}

	if spec.Datasource != nil {
		modelData["datasource"] = spec.Datasource
	}

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	cmd := &model.PatchLibraryElementCommand{
		UID:     panel.Name,
		Name:    spec.Title,
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

// getLegacyID reads legacy ID from metadata annotations
func getLegacyLibraryPanelID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}
