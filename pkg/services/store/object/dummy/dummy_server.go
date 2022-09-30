package objectdummyserver

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/x/persistentcollection"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type RawObjectWithHistory struct {
	*object.RawObject `json:"rawObject,omitempty"`
	History           []*object.RawObject `json:"history,omitempty"`
}

var (
	// increment when RawObject changes
	rawObjectVersion = 1
)

func ProvideDummyObjectServer(cfg *setting.Cfg, grpcServerProvider grpcserver.Provider) object.ObjectStoreServer {
	objectServer := &dummyObjectServer{
		collection: persistentcollection.NewLocalFSPersistentCollection[*RawObjectWithHistory]("raw-object", cfg.DataPath, rawObjectVersion),
		log:        log.New("in-memory-object-server"),
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type dummyObjectServer struct {
	log        log.Logger
	collection persistentcollection.PersistentCollection[*RawObjectWithHistory]
}

func namespaceFromUID(uid string) string {
	// TODO
	return "orgId-1"
}

func userFromContext(ctx context.Context) *user.SignedInUser {
	// TODO implement in GRPC server
	return &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "fake",
	}
}

func (i dummyObjectServer) findObject(ctx context.Context, uid string, kind string, version string) (*RawObjectWithHistory, *object.RawObject, error) {
	if uid == "" {
		return nil, nil, errors.New("UID must not be empty")
	}

	obj, err := i.collection.FindFirst(ctx, namespaceFromUID(uid), func(i *RawObjectWithHistory) (bool, error) {
		return i.UID == uid && i.Kind == kind, nil
	})

	if err != nil {
		return nil, nil, err
	}

	if obj == nil {
		return nil, nil, nil
	}

	getLatestVersion := version == ""
	if getLatestVersion {
		objVersion := obj.History[len(obj.History)-1]
		return obj, objVersion, nil
	}

	for _, objVersion := range obj.History {
		if objVersion.Version == version {
			return obj, objVersion, nil
		}
	}

	return obj, nil, nil
}

func (i dummyObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	_, objVersion, err := i.findObject(ctx, r.UID, r.Kind, r.Version)
	if err != nil {
		return nil, err
	}

	if objVersion == nil {
		return &object.ReadObjectResponse{
			Object:      nil,
			SummaryJson: nil,
		}, nil
	}

	return &object.ReadObjectResponse{
		Object:      objVersion,
		SummaryJson: nil,
	}, nil
}

func (i dummyObjectServer) BatchRead(ctx context.Context, batchR *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
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

func (i dummyObjectServer) update(ctx context.Context, r *object.WriteObjectRequest, namespace string) (*object.WriteObjectResponse, error) {
	var updated *object.RawObject

	updatedCount, err := i.collection.Update(ctx, namespace, func(i *RawObjectWithHistory) (bool, *RawObjectWithHistory, error) {
		match := i.UID == r.UID && i.Kind == r.Kind
		if !match {
			return false, nil, nil
		}

		if r.PreviousVersion != "" && i.Version != r.PreviousVersion {
			return false, nil, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Version)
		}

		prevVersion, err := strconv.Atoi(i.Version)
		if err != nil {
			return false, nil, err
		}

		modifier := userFromContext(ctx)

		updated = &object.RawObject{
			UID:       r.UID,
			Kind:      r.Kind,
			Created:   i.Created,
			CreatedBy: i.CreatedBy,
			Modified:  time.Now().Unix(),
			ModifiedBy: &object.UserInfo{
				Id:    modifier.UserID,
				Login: modifier.Login,
			},
			Size:    int64(len(r.Body)),
			ETag:    createContentsHash(r.Body),
			Body:    r.Body,
			Version: fmt.Sprintf("%d", prevVersion+1),
			Comment: r.Comment,
		}

		return true, &RawObjectWithHistory{
			RawObject: updated,
			History:   append(i.History, updated),
		}, nil
	})

	if err != nil {
		return nil, err
	}

	if updatedCount == 0 {
		return nil, fmt.Errorf("could not find object with uid %s and kind %s", r.UID, r.Kind)
	}

	return &object.WriteObjectResponse{
		Error:  nil,
		Object: updated,
	}, nil
}

func (i dummyObjectServer) insert(ctx context.Context, r *object.WriteObjectRequest, namespace string) (*object.WriteObjectResponse, error) {
	modifier := userFromContext(ctx)
	rawObj := &object.RawObject{
		UID:      r.UID,
		Kind:     r.Kind,
		Modified: time.Now().Unix(),
		Created:  time.Now().Unix(),
		CreatedBy: &object.UserInfo{
			Id:    modifier.UserID,
			Login: modifier.Login,
		},
		ModifiedBy: &object.UserInfo{
			Id:    modifier.UserID,
			Login: modifier.Login,
		},
		Size:    int64(len(r.Body)),
		ETag:    createContentsHash(r.Body),
		Body:    r.Body,
		Version: fmt.Sprintf("%d", 1),
		Comment: r.Comment,
	}
	newObj := &RawObjectWithHistory{
		RawObject: rawObj,
		History:   []*object.RawObject{rawObj},
	}

	err := i.collection.Insert(ctx, namespace, newObj)
	if err != nil {
		return nil, err
	}

	return &object.WriteObjectResponse{
		Error:  nil,
		Object: newObj.RawObject,
	}, nil
}

func (i dummyObjectServer) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	namespace := namespaceFromUID(r.UID)
	obj, err := i.collection.FindFirst(ctx, namespace, func(i *RawObjectWithHistory) (bool, error) {
		return i.UID == r.UID, nil
	})
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return i.insert(ctx, r, namespace)
	}

	return i.update(ctx, r, namespace)
}

func (i dummyObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	_, err := i.collection.Delete(ctx, namespaceFromUID(r.UID), func(i *RawObjectWithHistory) (bool, error) {
		match := i.UID == r.UID && i.Kind == r.Kind
		if match {
			if r.PreviousVersion != "" && i.Version != r.PreviousVersion {
				return false, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, i.Version)
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

func (i dummyObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	obj, _, err := i.findObject(ctx, r.UID, r.Kind, "")
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return &object.ObjectHistoryResponse{
			Object: nil,
		}, nil
	}

	return &object.ObjectHistoryResponse{
		Object: obj.History,
	}, nil
}

func (i dummyObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	var kindMap map[string]bool
	if len(r.Kind) != 0 {
		kindMap = make(map[string]bool)
		for _, k := range r.Kind {
			kindMap[k] = true
		}
	}

	// TODO more filters
	objects, err := i.collection.Find(ctx, namespaceFromUID("TODO"), func(i *RawObjectWithHistory) (bool, error) {
		if len(r.Kind) != 0 {
			if _, ok := kindMap[i.Kind]; !ok {
				return false, nil
			}
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}

	rawObjects := make([]*object.RawObject, 0)
	for _, o := range objects {
		rawObjects = append(rawObjects, o.RawObject)
	}

	return &object.ObjectSearchResponse{
		Results: rawObjects,
	}, nil
}
