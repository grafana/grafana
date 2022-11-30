package dummy

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
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/setting"
)

type EntityVersionWithBody struct {
	*entity.EntityVersionInfo `json:"info,omitempty"`

	Body []byte `json:"body,omitempty"`
}

type EntityWithHistory struct {
	Entity  *entity.Entity           `json:"entity,omitempty"`
	History []*EntityVersionWithBody `json:"history,omitempty"`
}

var (
	// increment when Entity changes
	rawEntityVersion = 10
)

// Make sure we implement both store + admin
var _ entity.EntityStoreServer = &dummyEntityServer{}
var _ entity.EntityStoreAdminServer = &dummyEntityServer{}

func ProvideDummyEntityServer(cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, kinds kind.KindRegistry) entity.EntityStoreServer {
	objectServer := &dummyEntityServer{
		collection: persistentcollection.NewLocalFSPersistentCollection[*EntityWithHistory]("raw-object", cfg.DataPath, rawEntityVersion),
		log:        log.New("in-memory-object-server"),
		kinds:      kinds,
	}
	entity.RegisterEntityStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type dummyEntityServer struct {
	log        log.Logger
	collection persistentcollection.PersistentCollection[*EntityWithHistory]
	kinds      kind.KindRegistry
}

func namespaceFromUID(grn *entity.GRN) string {
	// TODO
	return "orgId-1"
}

func (i *dummyEntityServer) findEntity(ctx context.Context, grn *entity.GRN, version string) (*EntityWithHistory, *entity.Entity, error) {
	if grn == nil {
		return nil, nil, errors.New("GRN must not be nil")
	}

	obj, err := i.collection.FindFirst(ctx, namespaceFromUID(grn), func(i *EntityWithHistory) (bool, error) {
		return grn.Equals(i.Entity.GRN), nil
	})

	if err != nil {
		return nil, nil, err
	}

	if obj == nil {
		return nil, nil, nil
	}

	getLatestVersion := version == ""
	if getLatestVersion {
		return obj, obj.Entity, nil
	}

	for _, objVersion := range obj.History {
		if objVersion.Version == version {
			copy := &entity.Entity{
				GRN:       obj.Entity.GRN,
				CreatedAt: obj.Entity.CreatedAt,
				CreatedBy: obj.Entity.CreatedBy,
				UpdatedAt: objVersion.UpdatedAt,
				UpdatedBy: objVersion.UpdatedBy,
				ETag:      objVersion.ETag,
				Version:   objVersion.Version,

				// Body is added from the dummy server cache (it does not exist in EntityVersionInfo)
				Body: objVersion.Body,
			}

			return obj, copy, nil
		}
	}

	return obj, nil, nil
}

func (i *dummyEntityServer) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.ReadEntityResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	_, objVersion, err := i.findEntity(ctx, grn, r.Version)
	if err != nil {
		return nil, err
	}

	if objVersion == nil {
		return &entity.ReadEntityResponse{
			Entity:      nil,
			SummaryJson: nil,
		}, nil
	}

	rsp := &entity.ReadEntityResponse{
		Entity: objVersion,
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

func (i *dummyEntityServer) BatchRead(ctx context.Context, batchR *entity.BatchReadEntityRequest) (*entity.BatchReadEntityResponse, error) {
	results := make([]*entity.ReadEntityResponse, 0)
	for _, r := range batchR.Batch {
		resp, err := i.Read(ctx, r)
		if err != nil {
			return nil, err
		}
		results = append(results, resp)
	}

	return &entity.BatchReadEntityResponse{Results: results}, nil
}

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

func (i *dummyEntityServer) update(ctx context.Context, r *entity.AdminWriteEntityRequest, namespace string) (*entity.WriteEntityResponse, error) {
	builder := i.kinds.GetSummaryBuilder(r.GRN.Kind)
	if builder == nil {
		return nil, fmt.Errorf("unsupported kind: " + r.GRN.Kind)
	}
	rsp := &entity.WriteEntityResponse{}

	updatedCount, err := i.collection.Update(ctx, namespace, func(i *EntityWithHistory) (bool, *EntityWithHistory, error) {
		if !r.GRN.Equals(i.Entity.GRN) {
			return false, nil, nil
		}

		if r.PreviousVersion != "" && i.Entity.Version != r.PreviousVersion {
			return false, nil, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Entity.Version)
		}

		prevVersion, err := strconv.Atoi(i.Entity.Version)
		if err != nil {
			return false, nil, err
		}

		modifier := store.UserFromContext(ctx)

		updated := &entity.Entity{
			GRN:       r.GRN,
			CreatedAt: i.Entity.CreatedAt,
			CreatedBy: i.Entity.CreatedBy,
			UpdatedAt: time.Now().UnixMilli(),
			UpdatedBy: store.GetUserIDString(modifier),
			Size:      int64(len(r.Body)),
			ETag:      createContentsHash(r.Body),
			Body:      r.Body,
			Version:   fmt.Sprintf("%d", prevVersion+1),
		}

		versionInfo := &EntityVersionWithBody{
			Body: r.Body,
			EntityVersionInfo: &entity.EntityVersionInfo{
				Version:   updated.Version,
				UpdatedAt: updated.UpdatedAt,
				UpdatedBy: updated.UpdatedBy,
				Size:      updated.Size,
				ETag:      updated.ETag,
				Comment:   r.Comment,
			},
		}
		rsp.Entity = versionInfo.EntityVersionInfo
		rsp.Status = entity.WriteEntityResponse_UPDATED

		// When saving, it must be different than the head version
		if i.Entity.ETag == updated.ETag {
			versionInfo.EntityVersionInfo.Version = i.Entity.Version
			rsp.Status = entity.WriteEntityResponse_UNCHANGED
			return false, nil, nil
		}

		return true, &EntityWithHistory{
			Entity:  updated,
			History: append(i.History, versionInfo),
		}, nil
	})

	if err != nil {
		return nil, err
	}

	if updatedCount == 0 && rsp.Entity == nil {
		return nil, fmt.Errorf("could not find object: %v", r.GRN)
	}

	return rsp, nil
}

func (i *dummyEntityServer) insert(ctx context.Context, r *entity.AdminWriteEntityRequest, namespace string) (*entity.WriteEntityResponse, error) {
	modifier := store.GetUserIDString(store.UserFromContext(ctx))
	rawObj := &entity.Entity{
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

	info := &entity.EntityVersionInfo{
		Version:   rawObj.Version,
		UpdatedAt: rawObj.UpdatedAt,
		UpdatedBy: rawObj.UpdatedBy,
		Size:      rawObj.Size,
		ETag:      rawObj.ETag,
		Comment:   r.Comment,
	}

	newObj := &EntityWithHistory{
		Entity: rawObj,
		History: []*EntityVersionWithBody{{
			EntityVersionInfo: info,
			Body:              r.Body,
		}},
	}

	err := i.collection.Insert(ctx, namespace, newObj)
	if err != nil {
		return nil, err
	}

	return &entity.WriteEntityResponse{
		Error:  nil,
		Entity: info,
		Status: entity.WriteEntityResponse_CREATED,
	}, nil
}

func (i *dummyEntityServer) Write(ctx context.Context, r *entity.WriteEntityRequest) (*entity.WriteEntityResponse, error) {
	return i.doWrite(ctx, entity.ToAdminWriteEntityRequest(r))
}

func (i *dummyEntityServer) AdminWrite(ctx context.Context, r *entity.AdminWriteEntityRequest) (*entity.WriteEntityResponse, error) {
	// Check permissions?
	return i.doWrite(ctx, r)
}

func (i *dummyEntityServer) doWrite(ctx context.Context, r *entity.AdminWriteEntityRequest) (*entity.WriteEntityResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	namespace := namespaceFromUID(grn)
	obj, err := i.collection.FindFirst(ctx, namespace, func(i *EntityWithHistory) (bool, error) {
		if i == nil || r == nil {
			return false, nil
		}
		return grn.Equals(i.Entity.GRN), nil
	})
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return i.insert(ctx, r, namespace)
	}

	return i.update(ctx, r, namespace)
}

func (i *dummyEntityServer) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	_, err := i.collection.Delete(ctx, namespaceFromUID(grn), func(i *EntityWithHistory) (bool, error) {
		if grn.Equals(i.Entity.GRN) {
			if r.PreviousVersion != "" && i.Entity.Version != r.PreviousVersion {
				return false, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Entity.Version)
			}

			return true, nil
		}

		return false, nil
	})

	if err != nil {
		return nil, err
	}

	return &entity.DeleteEntityResponse{
		OK: true,
	}, nil
}

func (i *dummyEntityServer) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	grn := getFullGRN(ctx, r.GRN)
	obj, _, err := i.findEntity(ctx, grn, "")
	if err != nil {
		return nil, err
	}

	rsp := &entity.EntityHistoryResponse{}
	if obj != nil {
		// Return the most recent versions first
		// Better? save them in this order?
		for i := len(obj.History) - 1; i >= 0; i-- {
			rsp.Versions = append(rsp.Versions, obj.History[i].EntityVersionInfo)
		}
	}
	return rsp, nil
}

func (i *dummyEntityServer) Search(ctx context.Context, r *entity.EntitySearchRequest) (*entity.EntitySearchResponse, error) {
	var kindMap map[string]bool
	if len(r.Kind) != 0 {
		kindMap = make(map[string]bool)
		for _, k := range r.Kind {
			kindMap[k] = true
		}
	}

	// TODO more filters
	objects, err := i.collection.Find(ctx, namespaceFromUID(&entity.GRN{}), func(i *EntityWithHistory) (bool, error) {
		if len(r.Kind) != 0 {
			if _, ok := kindMap[i.Entity.GRN.Kind]; !ok {
				return false, nil
			}
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}

	searchResults := make([]*entity.EntitySearchResult, 0)
	for _, o := range objects {
		builder := i.kinds.GetSummaryBuilder(o.Entity.GRN.Kind)
		if builder == nil {
			continue
		}
		summary, clean, e2 := builder(ctx, o.Entity.GRN.UID, o.Entity.Body)
		if e2 != nil {
			continue
		}

		searchResults = append(searchResults, &entity.EntitySearchResult{
			GRN:         o.Entity.GRN,
			Version:     o.Entity.Version,
			UpdatedAt:   o.Entity.UpdatedAt,
			UpdatedBy:   o.Entity.UpdatedBy,
			Name:        summary.Name,
			Description: summary.Description,
			Body:        clean,
		})
	}

	return &entity.EntitySearchResponse{
		Results: searchResults,
	}, nil
}

// This sets the TenantId on the request GRN
func getFullGRN(ctx context.Context, grn *entity.GRN) *entity.GRN {
	if grn.TenantId == 0 {
		modifier := store.UserFromContext(ctx)
		grn.TenantId = modifier.OrgID
	}
	return grn
}
