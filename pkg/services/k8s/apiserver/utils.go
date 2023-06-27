package apiserver

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// Convert an etcd key to GRN style
func keyToGRN(key string, gr *schema.GroupResource) (*entity.GRN, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return nil, fmt.Errorf("invalid key (expecting three parts) " + key)
	}

	grn := &entity.GRN{
		TenantId: 1,
		Kind:     strings.TrimSuffix(gr.Resource, "s"), // dashboards to dashboard :shrug:
		UID:      parts[4],
	}

	namespace := parts[3]
	if namespace == "default" {
		return grn, nil
	}
	tid := strings.Split(namespace, "-")
	if len(tid) != 2 || !(tid[0] == "org" || tid[0] == "tenant") {
		return nil, fmt.Errorf("invalid namespace, expected org|tenant-${#}")
	}
	intVar, err := strconv.ParseInt(tid[1], 0, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid namespace, expected number")
	}
	grn.TenantId = intVar
	return grn, nil
}

// this is terrible... but just making it work!!!!
func enityToResource(rsp *entity.Entity) (kinds.GrafanaResource[map[string]interface{}, map[string]interface{}], error) {
	var err error
	rrr := kinds.GrafanaResource[map[string]interface{}, map[string]interface{}]{}
	if len(rsp.Meta) > 0 {
		err = json.Unmarshal(rsp.Meta, &rrr.Metadata)
		if err != nil {
			return rrr, err
		}
	}
	if rrr.Metadata.Annotations == nil {
		rrr.Metadata.Annotations = make(map[string]string)
	}
	if rsp.Folder != "" {
		rrr.Metadata.SetFolder(rsp.Folder)
	}
	if rsp.CreatedBy != "" {
		rrr.Metadata.SetCreatedBy(rsp.CreatedBy)
	}
	if rsp.UpdatedBy != "" {
		rrr.Metadata.SetUpdatedBy(rsp.UpdatedBy)
	}

	// Already saved in each payload
	// rrr.Metadata.UID = types.UID(rsp.Guid)

	// if rrr.Metadata.Name == "" {
	// 	rrr.Metadata.Name = rsp.GRN.UID
	// }
	// if rrr.Metadata.Namespace == "" {
	// 	if rsp.GRN.TenantId > 1 {
	// 		rrr.Metadata.Namespace = fmt.Sprintf("tenant-%d", rsp.GRN.TenantId)
	// 	} else {
	// 		rrr.Metadata.Namespace = "default" // org 1
	// 	}
	// }

	if len(rsp.Body) > 0 {
		var m map[string]interface{}
		err = json.Unmarshal(rsp.Body, &m)
		if err != nil {
			return rrr, err
		}
		rrr.Spec = &m
	}
	if len(rsp.Status) > 0 {
		var m map[string]interface{}
		err = json.Unmarshal(rsp.Status, &m)
		if err != nil {
			return rrr, err
		}
		rrr.Status = &m
	}
	return rrr, err
}

func contextWithFakeGrafanaUser(ctx context.Context) (context.Context, error) {
	info, ok := request.UserFrom(ctx)
	if !ok {
		return ctx, fmt.Errorf("could not find k8s user info in context")
	}

	var err error
	user := &user.SignedInUser{
		UserID: -1,
		OrgID:  -1,
		Name:   info.GetName(),
	}
	if user.Name == "system:apiserver" {
		user.OrgID = 1
		user.UserID = 1
	}
	v, ok := info.GetExtra()["user-id"]
	if ok && len(v) > 0 {
		user.UserID, err = strconv.ParseInt(v[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
		}
	}
	v, ok = info.GetExtra()["org-id"]
	if ok && len(v) > 0 {
		user.OrgID, err = strconv.ParseInt(v[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
		}
	}

	if user.OrgID < 0 || user.UserID < 0 {
		// Aggregated mode.... need to map this to a real user somehow
		user.OrgID = 1
		user.UserID = 1
		// return nil, fmt.Errorf("insufficient information on user context, couldn't determine UserID and OrgID")
	}

	// HACK alert... change to the reqested org
	// TODO: should validate that user has access to that org/tenant
	ns, ok := request.NamespaceFrom(ctx)
	if ok {
		nsorg, err := util.NamespaceToOrgID(ns)
		if err != nil {
			return nil, err
		}
		user.OrgID = nsorg
	}
	return appcontext.WithUser(ctx, user), nil
}

// this is terrible... but just making it work!!!!
func historyAsResource(grn *entity.GRN, rsp *entity.EntityHistoryResponse) kinds.GrafanaResource[map[string]interface{}, map[string]interface{}] {
	resource := kinds.GrafanaResource[map[string]interface{}, map[string]interface{}]{
		Metadata: kinds.GrafanaResourceMetadata{
			Name: grn.UID,
		},
		Spec: &map[string]interface{}{
			"versions": rsp.Versions,
		},
	}
	if rsp.NextPageToken != "" {
		(*resource.Spec)["next"] = rsp.NextPageToken
	}
	return resource
}
