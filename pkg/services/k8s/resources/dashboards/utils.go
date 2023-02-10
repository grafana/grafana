package dashboards

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/services/dashboards"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
)

// This makes a consistent mapping between Grafana UIDs and k8s compatible names
func GrafanaUIDToK8sName(uid string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(uid))
	bs := h.Sum(nil)
	return fmt.Sprintf("g%x", bs[:12])
}

// Gets resource version tells us whether there was an error or not found
func getResourceVersion(ctx context.Context, resourceClient dynamic.ResourceInterface, uid string) (string, bool, error) {
	name := GrafanaUIDToK8sName(uid)
	r, err := resourceClient.Get(ctx, name, metav1.GetOptions{})
	if err == nil {
		return r.GetResourceVersion(), true, nil
	}

	if err != nil && strings.Contains(err.Error(), "not found") {
		return "", true, nil
	}

	return "", false, err
}

func stripNulls(j *simplejson.Json) {
	m, err := j.Map()
	if err != nil {
		arr, err := j.Array()
		if err == nil {
			for i := range arr {
				stripNulls(j.GetIndex(i))
			}
		}
		return
	}
	for k, v := range m {
		if v == nil {
			j.Del(k)
		} else {
			stripNulls(j.Get(k))
		}
	}
}

func annotationsFromDashboardDTO(dto *dashboards.SaveDashboardDTO) map[string]string {
	annotations := map[string]string{
		"version":   strconv.FormatInt(int64(dto.Dashboard.Version), 10),
		"message":   dto.Message,
		"orgID":     strconv.FormatInt(dto.OrgID, 10),
		"updatedBy": strconv.FormatInt(dto.Dashboard.UpdatedBy, 10),
		"updatedAt": strconv.FormatInt(dto.Dashboard.Updated.UnixNano(), 10),
		"createdBy": strconv.FormatInt(dto.Dashboard.CreatedBy, 10),
		"createdAt": strconv.FormatInt(dto.Dashboard.Created.UnixNano(), 10),
		"folderID":  strconv.FormatInt(dto.Dashboard.FolderID, 10),
		"isFolder":  strconv.FormatBool(dto.Dashboard.IsFolder),
		"hasACL":    strconv.FormatBool(dto.Dashboard.HasACL),
		"slug":      dto.Dashboard.Slug,
		"title":     dto.Dashboard.Title,
	}

	return annotations
}

// TODO: this is a hack to convert the k8s dashboard to a DTO
func interfaceToK8sDashboard(obj interface{}) (*k8ssys.Base[dashboard.Dashboard], error) {
	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("failed to convert interface{} to *unstructured.Unstructured")
	}

	dash := k8ssys.Base[dashboard.Dashboard]{}
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(uObj.UnstructuredContent(), &dash)
	if err != nil {
		return nil, fmt.Errorf("failed to convert *unstructured.Unstructured to *k8ssys.Base[dashboard.Dashboard]")
	}
	return &dash, nil
}

// TODO: this is a hack to convert the k8s dashboard to a DTO
// unclear if any of the fields are missing at this point.
func k8sDashboardToDashboardDTO(dash *k8ssys.Base[dashboard.Dashboard]) (*dashboards.SaveDashboardDTO, error) {
	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
	data.Set("resourceVersion", dash.ResourceVersion)
	dto := dashboards.SaveDashboardDTO{
		Dashboard: &dashboards.Dashboard{
			FolderID: 0,
			IsFolder: false,
			Data:     data,
		},
	}
	if dash.Spec.Id != nil {
		dto.Dashboard.ID = *dash.Spec.Id
	}
	if dash.Spec.Uid != nil {
		dto.Dashboard.UID = *dash.Spec.Uid
	}
	if dash.Spec.Title != nil {
		dto.Dashboard.Title = *dash.Spec.Title
	}
	if dash.Spec.Version != nil {
		dto.Dashboard.Version = *dash.Spec.Version
	}
	if dash.Spec.GnetId != nil {
		gnetId, err := strconv.ParseInt(*dash.Spec.GnetId, 10, 64)
		if err == nil {
			dto.Dashboard.GnetID = gnetId
		}
	}

	dto = parseAnnotations(dash, dto)

	return &dto, nil
}

// parse k8s annotations into DTO fields
func parseAnnotations(dash *k8ssys.Base[dashboard.Dashboard], dto dashboards.SaveDashboardDTO) dashboards.SaveDashboardDTO {
	if dash.ObjectMeta.Annotations == nil {
		return dto
	}
	a := dash.ObjectMeta.Annotations
	if v, ok := a["message"]; ok {
		dto.Message = v
	}

	if v, ok := a["orgID"]; ok {
		orgID, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.OrgID = orgID
		}
	}

	if v, ok := a["updatedBy"]; ok {
		updatedBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.UpdatedBy = updatedBy
		}
	}

	if v, ok := a["updatedAt"]; ok {
		updatedAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Updated = time.Unix(0, updatedAt)
			dto.UpdatedAt = time.Unix(0, updatedAt)
		}
	}

	if v, ok := a["createdBy"]; ok {
		createdBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.CreatedBy = createdBy
		}
	}

	if v, ok := a["createdAt"]; ok {
		createdAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Created = time.Unix(0, createdAt)
		}
	}

	if v, ok := a["folderID"]; ok {
		folderId, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.FolderID = folderId
		}
	}

	if v, ok := a["isFolder"]; ok {
		isFolder, err := strconv.ParseBool(v)
		if err == nil {
			dto.Dashboard.IsFolder = isFolder
		}
	}

	if v, ok := a["pluginID"]; ok {
		dto.Dashboard.PluginID = v
	}

	if v, ok := a["version"]; ok {
		version, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			dto.Dashboard.Version = int(version)
		}
	}

	if v, ok := a["hasACL"]; ok {
		hasACL, err := strconv.ParseBool(v)
		if err == nil {
			dto.Dashboard.HasACL = hasACL
		}
	}

	if v, ok := a["slug"]; ok {
		dto.Dashboard.Slug = v
	}

	if v, ok := a["title"]; ok {
		dto.Dashboard.Title = v
	}

	return dto
}
