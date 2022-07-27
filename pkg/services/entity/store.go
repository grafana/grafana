package entity

import (
	"context"
	"fmt"
	"reflect"

	"github.com/gogo/status"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/entity/kind"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/store"
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
	kinds  entity.KindRegistry
	search searchV2.SearchService
	store  store.StorageService
}

func ProvideService(search searchV2.SearchService, store store.StorageService) EntityStore {
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
		kinds:  k,
		search: search,
		store:  store,
	}
	return srv
}

func (s *StandardEntityStoreServer) GetKinds() entity.KindRegistry {
	return s.kinds
}

func (s *StandardEntityStoreServer) GetEntity(ctx context.Context, req *entity.GetEntityRequest) (*entity.EntityMessage, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)

	path := req.Path
	kind := s.kinds.GetFromSuffix(path)
	// if kind == nil {
	// 	kind = entity.FolderKind
	// 	path = filepath.Join(path, "__folder.json")
	// }
	file, err := s.store.Read(ctx, user, path)
	if err != nil {
		return nil, err
	}

	rsp := &entity.EntityMessage{
		Path: req.Path,
	}
	if kind != nil {
		rsp.Kind = kind.Info().ID
	}

	if req.WithPayload {
		rsp.Payload = file.Contents
	}

	if req.WithStorageMeta {
		version := req.Version
		if version == "" {
			version = "aaa" // TODO!!!
		}

		rsp.Meta = &entity.StorageMetadata{
			CreatedAt: file.Created.Unix(),
			UpdatedAt: file.Modified.Unix(),
			Size:      file.Size,

			UpdatedBy: "??",
			Version:   version,
		}
	}
	return rsp, nil
}

func (s *StandardEntityStoreServer) ListFolder(ctx context.Context, req *entity.ListFolderRequest) (*entity.FolderListing, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)
	fmt.Printf("TODO: %v/%v\n", user, req)
	return nil, status.Errorf(codes.Unimplemented, "method ListFolder not implemented")
}

func (s *StandardEntityStoreServer) SaveEntity(ctx context.Context, req *entity.SaveEntityRequest) (*entity.EntityMessage, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)
	fmt.Printf("TODO: %v/%v\n", user, req)
	return nil, status.Errorf(codes.Unimplemented, "method SaveEntity not implemented")
}

func (s *StandardEntityStoreServer) DeleteEntity(ctx context.Context, req *entity.DeleteEntityRequest) (*entity.DeleteResponse, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)
	fmt.Printf("TODO: %v/%v\n", user, req)
	return nil, status.Errorf(codes.Unimplemented, "method DeleteEntity not implemented")
}

func (s *StandardEntityStoreServer) GetEntityHistory(ctx context.Context, req *entity.GetHistoryRequest) (*entity.EntityHistoryResponse, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)
	fmt.Printf("TODO: %v/%v\n", user, req)

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

func (s *StandardEntityStoreServer) CreatePR(ctx context.Context, req *entity.CreatePullRequest) (*entity.EntityMessage, error) {
	user := ctx.Value(tempSignedInUserKey).(*models.SignedInUser)
	fmt.Printf("TODO: %v/%v\n", user, req)

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
