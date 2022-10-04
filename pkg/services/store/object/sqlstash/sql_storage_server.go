package sqlstash

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideSQLObjectServer(db db.DB, cfg *setting.Cfg, grpcServerProvider grpcserver.Provider) object.ObjectStoreServer {
	objectServer := &sqlObjectServer{
		sess: db.GetSqlxSession(),
		log:  log.New("in-memory-object-server"),
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type sqlObjectServer struct {
	log  log.Logger
	sess *session.SessionDB
}

func (s sqlObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (s sqlObjectServer) BatchRead(ctx context.Context, batchR *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

func userFromContext(ctx context.Context) *user.SignedInUser {
	// TODO implement in GRPC server
	return &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
		Login:  "fake",
	}
}

func (s sqlObjectServer) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	summary := object.ObjectSummary{
		Name:        "hello",
		Description: "description",
	}

	etag := createContentsHash(r.Body)
	summaryjson, err := json.Marshal(summary)
	if err != nil {
		return nil, err
	}

	orgId := 123
	rsp := &object.WriteObjectResponse{}
	modifier := userFromContext(ctx)

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		timestamp := time.Now()
		versionInfo := &object.ObjectVersionInfo{
			Version:  "1",
			Comment:  r.Comment,
			Size:     int64(len(r.Body)),
			ETag:     etag,
			Modified: timestamp.Unix(),
			ModifiedBy: &object.UserInfo{
				Id:    modifier.UserID,
				Login: modifier.Login,
			},
		}
		rsp.Object = versionInfo

		query :=
			`INSERT INTO object (` +
				`"key", "parent_folder_key", "kind", "size", "body", "etag", "version",` +
				`"updated", "updated_by", "created", "created_by",` +
				`"name", "description", "summary") ` +
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

		key := fmt.Sprintf("%d/%s.%s", orgId, r.UID, r.Kind)
		parent_folder_key := "???"

		rsp, err := tx.Exec(ctx, query,
			key, parent_folder_key, r.Kind, versionInfo.Size, r.Body, etag, versionInfo.Version,
			timestamp, modifier.UserID, timestamp, modifier.UserID, // created + modified
			summary.Name,
			summary.Description,
			string(summaryjson),
		)
		if err != nil {
			return err
		}

		fmt.Printf("GOT: %v\n", rsp)

		return nil
	})

	return rsp, err
}

func (s sqlObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (s sqlObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}

func (s sqlObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	return nil, fmt.Errorf("not implemented yet")
}
