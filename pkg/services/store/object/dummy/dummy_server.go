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
		collection: newCollection[*RawObjectWithHistory]("raw-object", cfg.DataPath, rawObjectVersion),
		log:        log.New("in-memory-object-server"),
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type dummyObjectServer struct {
	log        log.Logger
	collection collection[*RawObjectWithHistory]
}

func orgIdFromUID(uid string) int64 {
	// TODO
	return 1
}

func userFromContext(ctx context.Context) *user.SignedInUser {
	// TODO implement in GRPC server
	return &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "fake",
	}
}

func (i dummyObjectServer) findObject(ctx context.Context, objects []*RawObjectWithHistory, uid string, kind string, version string) (*RawObjectWithHistory, *object.RawObject, error) {
	if uid == "" {
		return nil, nil, errors.New("UID must not be empty")
	}

	var obj *RawObjectWithHistory
	for _, o := range objects {
		if kind != "" && o.Kind != kind {
			continue
		}

		if o.UID == uid {
			obj = o
			break
		}
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
	objects, err := i.collection.Load(ctx, orgIdFromUID(r.UID))
	if err != nil {
		return nil, err
	}

	_, objVersion, err := i.findObject(ctx, objects, r.UID, r.Kind, r.Version)
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

func (i dummyObjectServer) update(ctx context.Context, r *object.WriteObjectRequest, orgID int64, objects []*RawObjectWithHistory) (*object.WriteObjectResponse, error) {
	obj, _, err := i.findObject(ctx, objects, r.UID, r.Kind, "")
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return nil, fmt.Errorf("could not find object with uid %s and kind %s", r.UID, r.Kind)
	}

	if r.PreviousVersion != "" && obj.Version != r.PreviousVersion {
		return nil, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, obj.Version)
	}

	prevVersion, err := strconv.Atoi(obj.Version)
	if err != nil {
		return nil, err
	}

	modifier := userFromContext(ctx)
	newVersion := &object.RawObject{
		UID:      obj.UID,
		Kind:     obj.Kind,
		Modified: time.Now().Unix(),
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
	obj.RawObject = newVersion
	obj.History = append(obj.History, newVersion)
	err = i.collection.Save(ctx, orgID, objects)
	if err != nil {
		return nil, err
	}

	return &object.WriteObjectResponse{
		Error:  nil,
		Object: newVersion,
	}, nil
}

func (i dummyObjectServer) insert(ctx context.Context, r *object.WriteObjectRequest, orgID int64, objects []*RawObjectWithHistory) (*object.WriteObjectResponse, error) {
	modifier := userFromContext(ctx)
	rawObj := &object.RawObject{
		UID:      r.UID,
		Kind:     r.Kind,
		Modified: time.Now().Unix(),
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

	err := i.collection.Save(ctx, orgID, append(objects, newObj))
	if err != nil {
		return nil, err
	}

	return &object.WriteObjectResponse{
		Error:  nil,
		Object: newObj.RawObject,
	}, nil
}

func (i dummyObjectServer) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	orgID := orgIdFromUID(r.UID)
	objects, err := i.collection.Load(ctx, orgID)
	if err != nil {
		return nil, err
	}
	obj, latestObjVersion, err := i.findObject(ctx, objects, r.UID, r.Kind, "")
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return i.insert(ctx, r, orgID, objects)
	}

	if latestObjVersion == nil {
		return nil, errors.New("latest object should never be nil")
	}

	return i.update(ctx, r, orgID, objects)
}

func (i dummyObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	orgID := orgIdFromUID(r.UID)
	objects, err := i.collection.Load(ctx, orgID)
	if err != nil {
		return nil, err
	}

	obj, _, err := i.findObject(ctx, objects, r.UID, r.Kind, "")
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return &object.DeleteObjectResponse{
			OK: true,
		}, nil
	}

	if r.PreviousVersion != "" && obj.Version != r.PreviousVersion {
		return nil, fmt.Errorf("expected the previous version to be %s, but was %s", r.PreviousVersion, obj.Version)
	}

	newObjects := make([]*RawObjectWithHistory, 0)
	for _, o := range objects {
		if r.Kind != "" && o.Kind != r.Kind {
			newObjects = append(newObjects, o)
			continue
		}

		if o.UID != r.UID {
			newObjects = append(newObjects, o)
			continue
		}
	}

	if err := i.collection.Save(ctx, orgID, newObjects); err != nil {
		return nil, err
	}

	return &object.DeleteObjectResponse{
		OK: true,
	}, nil
}

func (i dummyObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	objects, err := i.collection.Load(ctx, orgIdFromUID(r.UID))
	if err != nil {
		return nil, err
	}

	obj, _, err := i.findObject(ctx, objects, r.UID, r.Kind, "")
	if err != nil {
		return nil, err
	}

	if obj == nil {
		return &object.ObjectHistoryResponse{
			Object:  nil,
			Authors: nil,
		}, nil
	}

	createdTime := obj.History[0].Modified

	authors := make([]*object.UserInfo, 0)
	for _, objVersion := range obj.History {
		// TODO avoid duplicates
		// TODO why do we need it if we are returning obj.History?
		authors = append(authors, objVersion.ModifiedBy)
	}

	return &object.ObjectHistoryResponse{
		Object:      obj.History,
		Authors:     authors,
		CreatedTime: createdTime,
	}, nil
}

func (i dummyObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	// TODO filter
	objects, err := i.collection.Load(ctx, orgIdFromUID("TODO"))
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
