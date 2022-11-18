package objectdummyserver

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/x/persistentcollection"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/setting"
)

type ObjectVersionWithBody struct {
	*object.ObjectVersionInfo `json:"info,omitempty"`

	Body []byte `json:"body,omitempty"`
}

type RawObjectWithHistory struct {
	Object  *object.RawObject        `json:"object,omitempty"`
	History []*ObjectVersionWithBody `json:"history,omitempty"`
}

var (
	// increment when RawObject changes
	rawObjectVersion = 9
)

// Make sure we implement both store + admin
var _ object.ObjectStoreServer = &dummyObjectServer{}
var _ object.ObjectStoreAdminServer = &dummyObjectServer{}

func ProvideDummyObjectServer(cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, kinds kind.KindRegistry) object.ObjectStoreServer {
	objectServer := &dummyObjectServer{
		collection: persistentcollection.NewLocalFSPersistentCollection[*RawObjectWithHistory]("raw-object", cfg.DataPath, rawObjectVersion),
		log:        log.New("in-memory-object-server"),
		kinds:      kinds,
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type dummyObjectServer struct {
	log        log.Logger
	collection persistentcollection.PersistentCollection[*RawObjectWithHistory]
	kinds      kind.KindRegistry
}

func namespaceFromUID(grn *object.GRN) string {
	// TODO
	return "orgId-1"
}

func (i *dummyObjectServer) findObject(ctx context.Context, grn *object.GRN, version string) (*RawObjectWithHistory, *object.RawObject, error) {
	if grn == nil {
		return nil, nil, errors.New("GRN must not be nil")
	}

	obj, err := i.collection.FindFirst(ctx, namespaceFromUID(grn), func(i *RawObjectWithHistory) (bool, error) {
		return grn.Equals(i.Object.GRN), nil
	})

	if err != nil {
		return nil, nil, err
	}

	if obj == nil {
		return nil, nil, nil
	}

	getLatestVersion := version == ""
	if getLatestVersion {
		return obj, obj.Object, nil
	}

	for _, objVersion := range obj.History {
		if objVersion.Version == version {
			copy := &object.RawObject{
				GRN:       obj.Object.GRN,
				CreatedAt: obj.Object.CreatedAt,
				CreatedBy: obj.Object.CreatedBy,
				UpdatedAt: objVersion.UpdatedAt,
				UpdatedBy: objVersion.UpdatedBy,
				ETag:      objVersion.ETag,
				Version:   objVersion.Version,

				// Body is added from the dummy server cache (it does not exist in ObjectVersionInfo)
				Body: objVersion.Body,
			}

			return obj, copy, nil
		}
	}

	return obj, nil, nil
}

func (i *dummyObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	_, objVersion, err := i.findObject(ctx, grn, r.Version)
	if err != nil {
		return nil, err
	}

	if objVersion == nil {
		return &object.ReadObjectResponse{
			Object:      nil,
			SummaryJson: nil,
		}, nil
	}

	rsp := &object.ReadObjectResponse{
		Object: objVersion,
	}
	if r.WithSummary {
		// Since we do not store the summary, we can just recreate on demand
		builder := i.kinds.GetSummaryBuilder(r.GRN.Kind)
		if builder != nil {
			summary, _, e2 := builder(ctx, r.GRN.UID, objVersion.Body)
			if e2 != nil {
				return nil, e2
			}
			rsp.SummaryJson, err = json.Marshal(summary)
		}
	}
	return rsp, err
}

func (i *dummyObjectServer) BatchRead(ctx context.Context, batchR *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
	results := make([]*object.ReadObjectResponse, 0)
	for _, r := range batchR.Batch {
		resp, err := i.Read(ctx, r)
		if err != nil {
			return nil, err
		}
		results = append(results, resp)
	}

	return &object.BatchReadObjectResponse{Results: results}, nil
}

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

func (i *dummyObjectServer) update(ctx context.Context, r *object.AdminWriteObjectRequest, namespace string) (*object.WriteObjectResponse, error) {
	builder := i.kinds.GetSummaryBuilder(r.GRN.Kind)
	if builder == nil {
		return nil, fmt.Errorf("unsupported kind: " + r.GRN.Kind)
	}
	rsp := &object.WriteObjectResponse{}

	updatedCount, err := i.collection.Update(ctx, namespace, func(i *RawObjectWithHistory) (bool, *RawObjectWithHistory, error) {
		if !r.GRN.Equals(i.Object.GRN) {
			return false, nil, nil
		}

		if r.PreviousVersion != "" && i.Object.Version != r.PreviousVersion {
			return false, nil, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Object.Version)
		}

		prevVersion, err := strconv.Atoi(i.Object.Version)
		if err != nil {
			return false, nil, err
		}

		modifier := store.UserFromContext(ctx)

		updated := &object.RawObject{
			GRN:       r.GRN,
			CreatedAt: i.Object.CreatedAt,
			CreatedBy: i.Object.CreatedBy,
			UpdatedAt: time.Now().UnixMilli(),
			UpdatedBy: store.GetUserIDString(modifier),
			Size:      int64(len(r.Body)),
			ETag:      createContentsHash(r.Body),
			Body:      r.Body,
			Version:   fmt.Sprintf("%d", prevVersion+1),
		}

		versionInfo := &ObjectVersionWithBody{
			Body: r.Body,
			ObjectVersionInfo: &object.ObjectVersionInfo{
				Version:   updated.Version,
				UpdatedAt: updated.UpdatedAt,
				UpdatedBy: updated.UpdatedBy,
				Size:      updated.Size,
				ETag:      updated.ETag,
				Comment:   r.Comment,
			},
		}
		rsp.Object = versionInfo.ObjectVersionInfo
		rsp.Status = object.WriteObjectResponse_UPDATED

		// When saving, it must be different than the head version
		if i.Object.ETag == updated.ETag {
			versionInfo.ObjectVersionInfo.Version = i.Object.Version
			rsp.Status = object.WriteObjectResponse_UNCHANGED
			return false, nil, nil
		}

		return true, &RawObjectWithHistory{
			Object:  updated,
			History: append(i.History, versionInfo),
		}, nil
	})

	if err != nil {
		return nil, err
	}

	if updatedCount == 0 && rsp.Object == nil {
		return nil, fmt.Errorf("could not find object: %v", r.GRN)
	}

	return rsp, nil
}

func (i *dummyObjectServer) insert(ctx context.Context, r *object.AdminWriteObjectRequest, namespace string) (*object.WriteObjectResponse, error) {
	modifier := store.GetUserIDString(store.UserFromContext(ctx))
	rawObj := &object.RawObject{
		GRN:       r.GRN,
		UpdatedAt: time.Now().UnixMilli(),
		CreatedAt: time.Now().UnixMilli(),
		CreatedBy: modifier,
		UpdatedBy: modifier,
		Size:      int64(len(r.Body)),
		ETag:      createContentsHash(r.Body),
		Body:      r.Body,
		Version:   fmt.Sprintf("%d", 1),
	}

	info := &object.ObjectVersionInfo{
		Version:   rawObj.Version,
		UpdatedAt: rawObj.UpdatedAt,
		UpdatedBy: rawObj.UpdatedBy,
		Size:      rawObj.Size,
		ETag:      rawObj.ETag,
		Comment:   r.Comment,
	}

	newObj := &RawObjectWithHistory{
		Object: rawObj,
		History: []*ObjectVersionWithBody{{
			ObjectVersionInfo: info,
			Body:              r.Body,
		}},
	}

	err := i.collection.Insert(ctx, namespace, newObj)
	if err != nil {
		return nil, err
	}

	return &object.WriteObjectResponse{
		Error:  nil,
		Object: info,
		Status: object.WriteObjectResponse_CREATED,
	}, nil
}

func (i *dummyObjectServer) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	return i.doWrite(ctx, object.ToAdminWriteObjectRequest(r))
}

func (i *dummyObjectServer) AdminWrite(ctx context.Context, r *object.AdminWriteObjectRequest) (*object.WriteObjectResponse, error) {
	// Check permissions?
	return i.doWrite(ctx, r)
}

func (i *dummyObjectServer) doWrite(ctx context.Context, r *object.AdminWriteObjectRequest) (*object.WriteObjectResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	namespace := namespaceFromUID(grn)
	obj, err := i.collection.FindFirst(ctx, namespace, func(i *RawObjectWithHistory) (bool, error) {
		if i == nil || r == nil {
			return false, nil
		}
		return grn.Equals(i.Object.GRN), nil
	})
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return i.insert(ctx, r, namespace)
	}

	return i.update(ctx, r, namespace)
}

func (i *dummyObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	_, err := i.collection.Delete(ctx, namespaceFromUID(grn), func(i *RawObjectWithHistory) (bool, error) {
		if grn.Equals(i.Object.GRN) {
			if r.PreviousVersion != "" && i.Object.Version != r.PreviousVersion {
				return false, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Object.Version)
			}

			return true, nil
		}

		return false, nil
	})

	if err != nil {
		return nil, err
	}

	return &object.DeleteObjectResponse{
		OK: true,
	}, nil
}

func (i *dummyObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	obj, _, err := i.findObject(ctx, grn, "")
	if err != nil {
		return nil, err
	}

	rsp := &object.ObjectHistoryResponse{}
	if obj != nil {
		// Return the most recent versions first
		// Better? save them in this order?
		for i := len(obj.History) - 1; i >= 0; i-- {
			rsp.Versions = append(rsp.Versions, obj.History[i].ObjectVersionInfo)
		}
	}
	return rsp, nil
}

func (i *dummyObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	var kindMap map[string]bool
	if len(r.Kind) != 0 {
		kindMap = make(map[string]bool)
		for _, k := range r.Kind {
			kindMap[k] = true
		}
	}

	// TODO more filters
	objects, err := i.collection.Find(ctx, namespaceFromUID(&object.GRN{}), func(i *RawObjectWithHistory) (bool, error) {
		if len(r.Kind) != 0 {
			if _, ok := kindMap[i.Object.GRN.Kind]; !ok {
				return false, nil
			}
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}

	searchResults := make([]*object.ObjectSearchResult, 0)
	for _, o := range objects {
		builder := i.kinds.GetSummaryBuilder(o.Object.GRN.Kind)
		if builder == nil {
			continue
		}
		summary, clean, e2 := builder(ctx, o.Object.GRN.UID, o.Object.Body)
		if e2 != nil {
			continue
		}

		searchResults = append(searchResults, &object.ObjectSearchResult{
			GRN:         o.Object.GRN,
			Version:     o.Object.Version,
			UpdatedAt:   o.Object.UpdatedAt,
			UpdatedBy:   o.Object.UpdatedBy,
			Name:        summary.Name,
			Description: summary.Description,
			Body:        clean,
		})
	}

	return &object.ObjectSearchResponse{
		Results: searchResults,
	}, nil
}

// This sets the TenantId on the request GRN
func getFullGRN(ctx context.Context, grn *object.GRN) *object.GRN {
	if grn.TenantId == 0 {
		modifier := store.UserFromContext(ctx)
		grn.TenantId = modifier.OrgID
	}
	return grn
}
