package dashboard

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
)

// This makes an consistent mapping between Grafana UIDs and k8s compatible names
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

// TODO: this is a hack to convert the k8s dashboard to a DTO
// unclear if any of the fields are missing at this point.
func k8sDashboardToDashboardCommand(dash *Dashboard) (dashboards.SaveDashboardCommand, error) {
	cmd := dashboards.SaveDashboardCommand{}
	raw, err := json.Marshal(dash.Spec)
	if err != nil {
		return cmd, fmt.Errorf("failed to marshal dashboard spec: %w", err)
	}
	data, err := simplejson.NewJson(raw)
	if err != nil {
		return cmd, fmt.Errorf("failed to convert dashboard spec to simplejson %w", err)
	}
	data.Set("resourceVersion", dash.ResourceVersion)
	cmd.Dashboard = data

	// if dash.Spec.Id != nil {
	// 		dto.Dashboard.ID = *dash.Spec.Id
	// }
	// if dash.Spec.Uid != nil {
	// 	dto.Dashboard.UID = *dash.Spec.Uid
	// }
	// if dash.Spec.Title != nil {
	// 	dto.Dashboard.Title = *dash.Spec.Title
	// }
	// if dash.Spec.Version != nil {
	// 	dto.Dashboard.Version = *dash.Spec.Version
	// }
	// if dash.Spec.GnetId != nil {
	// 	gnetId, err := strconv.ParseInt(*dash.Spec.GnetId, 10, 64)
	// 	if err == nil {
	// 		dto.Dashboard.GnetID = gnetId
	// 	}
	// }

	cmd = parseAnnotations(dash, cmd)
	return cmd, nil
}

// parse k8s annotations into DTO fields
func parseAnnotations(dash *Dashboard, cmd dashboards.SaveDashboardCommand) dashboards.SaveDashboardCommand {
	if dash.ObjectMeta.Annotations == nil {
		return cmd
	}
	a := dash.ObjectMeta.Annotations
	if v, ok := a["message"]; ok {
		cmd.Message = v
	}

	if v, ok := a["orgID"]; ok {
		orgID, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			cmd.OrgID = orgID
		}
	}

	if v, ok := a["updatedBy"]; ok {
		updatedBy, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			cmd.UserID = updatedBy
			//??			dto.Dashboard.UpdatedBy = updatedBy
		}
	}

	if v, ok := a["updatedAt"]; ok {
		updatedAt, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			cmd.UpdatedAt = time.Unix(0, updatedAt)
		}
	}

	// if v, ok := a["createdBy"]; ok {
	// 	createdBy, err := strconv.ParseInt(v, 10, 64)
	// 	if err == nil {
	// 		dto.Dashboard.CreatedBy = createdBy
	// 	}
	// }

	// if v, ok := a["createdAt"]; ok {
	// 	createdAt, err := strconv.ParseInt(v, 10, 64)
	// 	if err == nil {
	// 		dto.Dashboard.Created = time.Unix(0, createdAt)
	// 	}
	// }

	if v, ok := a["folderID"]; ok {
		folderId, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			cmd.FolderID = folderId
		}
	}
	if v, ok := a["folderUID"]; ok {
		cmd.FolderUID = v
	}

	if v, ok := a["isFolder"]; ok {
		isFolder, err := strconv.ParseBool(v)
		if err == nil {
			cmd.IsFolder = isFolder
		}
	}

	if v, ok := a["pluginID"]; ok {
		cmd.PluginID = v
	}

	// if v, ok := a["version"]; ok {
	// 	version, err := strconv.ParseInt(v, 10, 64)
	// 	if err == nil {
	// 		dto.Dashboard.Version = int(version)
	// 	}
	// }

	// if v, ok := a["hasACL"]; ok {
	// 	hasACL, err := strconv.ParseBool(v)
	// 	if err == nil {
	// 		dto.Dashboard.HasACL = hasACL
	// 	}
	// }

	// if v, ok := a["slug"]; ok {
	// 	dto.Dashboard.Slug = v
	// }

	// if v, ok := a["title"]; ok {
	// 	dto.Dashboard.Title = v
	// }

	return cmd
}

func annotationsFromDashboardCMD(cmd dashboards.SaveDashboardCommand, dto *dashboards.Dashboard) map[string]string {
	annotations := map[string]string{
		"version":   strconv.FormatInt(int64(dto.Version), 10),
		"message":   cmd.Message,
		"orgID":     strconv.FormatInt(dto.OrgID, 10),
		"updatedBy": strconv.FormatInt(dto.UpdatedBy, 10),
		"updatedAt": strconv.FormatInt(dto.Updated.UnixNano(), 10),
		"createdBy": strconv.FormatInt(dto.CreatedBy, 10),
		"createdAt": strconv.FormatInt(dto.Created.UnixNano(), 10),
		"folderID":  strconv.FormatInt(dto.FolderID, 10),
		"folderUID": cmd.FolderUID,
		"isFolder":  strconv.FormatBool(cmd.IsFolder),
		"hasACL":    strconv.FormatBool(dto.HasACL),
		"slug":      dto.Slug,
		"title":     dto.Title,
	}

	return annotations
}
