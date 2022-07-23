package entity

import (
	"context"
	"fmt"
	"reflect"

	"github.com/gogo/status"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/entity/kind"
	"google.golang.org/grpc/codes"
)

type EntityStore interface {
	entity.EntityStoreServer

	// Expose the kinds
	GetKinds() entity.KindRegistry

	// Register HTTP paths
	RegisterEntityRoutes(apiRoute routing.RouteRegister)
	RegisterKindsRoutes(apiRoute routing.RouteRegister)
}

type StandardEntityStoreServer struct {
	entity.EntityStoreServer
	kinds entity.KindRegistry
}

func ProvideService() EntityStore {
	k, err := entity.NewKindRegistry(
		// Core types
		//----------------------
		&kind.DashboardKind{},

		// Images
		//----------------------
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "png",
				Description: "image",
				PathSuffix:  ".png",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "gif",
				Description: "image",
				PathSuffix:  ".gif",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "webp",
				Description: "image",
				PathSuffix:  ".webp",
			},
			nil, // could add a sanitizer here
		),
		entity.NewRawFileKind(
			entity.KindInfo{
				ID:          "svg",
				Description: "image",
				PathSuffix:  ".svg",
			},
			nil, // could add a sanitizer here
		),
	)
	if err != nil {
		// panic?
		fmt.Printf("ERROR: %+v\n", err)
	}
	srv := &StandardEntityStoreServer{
		kinds: k,
	}
	return srv
}

func (s *StandardEntityStoreServer) GetKinds() entity.KindRegistry {
	return s.kinds
}

func (s *StandardEntityStoreServer) GetEntity(_ context.Context, req *entity.GetEntityRequest) (*entity.EntityMessage, error) {
	kind := s.kinds.GetFromSuffix(req.Path)
	if kind == nil {
		kind = entity.FolderKind
	}

	rsp := &entity.EntityMessage{
		Path: req.Path,
		Kind: kind.Info().ID,
	}

	if req.WithPayload {
		rsp.Payload = []byte(`{"LOAD": "` + req.Path + `"}`)
	}

	if req.WithStorageMeta {
		version := req.Version
		if version == "" {
			version = "aaa"
		}

		rsp.Meta = &entity.StorageMetadata{
			CreatedAt: 1234,
			UpdatedBy: "??",
			Version:   version,
		}
	}
	return rsp, nil
}

func (s *StandardEntityStoreServer) ListFolder(context.Context, *entity.ListFolderRequest) (*entity.FolderListing, error) {
	return nil, status.Errorf(codes.Unimplemented, "method ListFolder not implemented")
}

func (s *StandardEntityStoreServer) SaveEntity(context.Context, *entity.SaveEntityRequest) (*entity.EntityMessage, error) {
	return nil, status.Errorf(codes.Unimplemented, "method SaveEntity not implemented")
}

func (s *StandardEntityStoreServer) DeleteEntity(context.Context, *entity.DeleteEntityRequest) (*entity.DeleteResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteEntity not implemented")
}

func (s *StandardEntityStoreServer) GetEntityHistory(_ context.Context, req *entity.GetHistoryRequest) (*entity.EntityHistoryResponse, error) {
	rsp := &entity.EntityHistoryResponse{
		Path:          req.Path,
		NextPageToken: "dummyNextToken",
	}
	for i := 0; i < 10; i++ {
		rsp.Event = append(rsp.Event, &entity.EntityHistory{
			When:    int64(10000 + i + 6000),
			Version: fmt.Sprintf("V%d", i),
			Who:     "aaa",
		})
	}
	return rsp, nil
}

func (s *StandardEntityStoreServer) CreatePR(context.Context, *entity.CreatePullRequest) (*entity.EntityMessage, error) {
	return nil, status.Errorf(codes.Unimplemented, "method CreatePR not implemented")
}

func (s *StandardEntityStoreServer) ListKinds(context.Context, *entity.ListKindsRequest) (*entity.ListKindsResponse, error) {
	kinds := s.kinds.List()
	rsp := &entity.ListKindsResponse{
		Kinds: make([]*entity.KindSummary, len(kinds)),
	}
	for i, k := range kinds {
		info := k.Info()
		gtype := reflect.TypeOf(k.GoType())
		rsp.Kinds[i] = &entity.KindSummary{
			ID:            info.ID,
			Description:   info.Description,
			Category:      info.Category,
			PathSuffix:    info.PathSuffix,
			HasSecureKeys: info.HasSecureKeys,
			IsRaw:         info.IsRaw,
			ContentType:   info.ContentType,

			// Things not copied from the info
			GoType: fmt.Sprintf("%s // %s", gtype.String(), gtype.PkgPath()),
		}
	}
	return rsp, nil
}

func (s *StandardEntityStoreServer) WatchEntity(*entity.GetEntityRequest, entity.EntityStore_WatchEntityServer) error {
	return status.Errorf(codes.Unimplemented, "method WatchEntity not implemented")
}
