package sqlstash

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
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
	// TODO: this needs to be extracted from the body content
	summary := object.ObjectSummary{
		Name:        "hello",
		Description: "description",
		Labels: map[string]string{
			"hello": "world",
			"test":  "",
		},
		References: []*object.ExternalReference{
			{
				Kind: "ds",
				Type: "influx",
				UID:  "xyz",
			},
		},
	}

	etag := createContentsHash(r.Body)
	summaryjson, err := json.Marshal(summary)
	if err != nil {
		return nil, err
	}

	modifier := userFromContext(ctx)
	key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)

	rsp := &object.WriteObjectResponse{}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		rows := make([]*object.ObjectVersionInfo, 0, 1) // TODO? is there a non-magic binding way to do this?
		err := s.sess.Select(ctx, &rows, `SELECT "etag","version" FROM object WHERE key=?`, key)
		if err != nil {
			return err
		}

		isUpdate := false
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

		// Check if it existed before
		if len(rows) > 0 {
			current := rows[0]
			if current.ETag == etag {
				rsp.Object = current // TODO more
				rsp.Status = object.WriteObjectResponse_UNCHANGED
				return nil
			}

			rsp.Status = object.WriteObjectResponse_MODIFIED
			isUpdate = true

			// Increment the version
			i, _ := strconv.ParseInt(current.Version, 0, 64)
			if i < 1 {
				i = timestamp.UnixMilli()
			}
			versionInfo.Version = fmt.Sprintf("%d", i+1)

			// Clear the labels+refs
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE object_key = ?", key); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE object_key = ?", key); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		_, err = tx.Exec(ctx, `INSERT INTO object_history (`+
			`"key", "version", "message", `+
			`"size", "body", "etag", `+
			`"updated", "updated_by") `+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			key, versionInfo.Version, versionInfo.Comment,
			versionInfo.Size, r.Body, versionInfo.ETag,
			timestamp, modifier.UserID,
		)
		if err != nil {
			return err
		}

		// 2. Add the labels rows

		// 3. Add the references rows

		// 4. Add/update the main `object` table
		rsp.Object = versionInfo
		if isUpdate {
			// TODO: the update
			return nil
		}

		// Insert the new row
		parent_folder_key := "???"
		query :=
			`INSERT INTO object (` +
				`"key", "parent_folder_key", "kind", "size", "body", "etag", "version",` +
				`"updated", "updated_by", "created", "created_by",` +
				`"name", "description", "summary") ` +
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

		_, err = tx.Exec(ctx, query,
			key, parent_folder_key, r.Kind, versionInfo.Size, r.Body, etag, versionInfo.Version,
			timestamp, modifier.UserID, timestamp, modifier.UserID, // created + modified
			summary.Name,
			summary.Description,
			string(summaryjson),
		)
		if err != nil {
			rsp.Status = object.WriteObjectResponse_CREATED
		}
		return err
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
