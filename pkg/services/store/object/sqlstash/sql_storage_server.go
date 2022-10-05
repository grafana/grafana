package sqlstash

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store/object"
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

func getReadSelect(r *object.ReadObjectRequest) string {
	fields := []string{
		`"key"`, `"kind"`, `"version"`,
		`"size"`, `"etag"`,
		`"created"`, `"created_by"`,
		`"updated"`, `"updated_by"`,
		`"sync_src"`, `"sync_time"`}

	if r.WithBody {
		fields = append(fields, `"body"`)
	}
	if r.WithSummary {
		fields = append(fields, `"summary"`)
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM object WHERE "
}

func rowToReadObjectResponse(rows *sql.Rows, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	created := time.Now()
	updated := time.Now()
	summary := "" // empty
	key := ""     // string (extract UID?)
	var syncSrc sql.NullString
	var syncTime sql.NullTime
	raw := &object.RawObject{
		CreatedBy: &object.UserInfo{},
		UpdatedBy: &object.UserInfo{},
	}

	args := []interface{}{
		&key, &raw.Kind, &raw.Version,
		&raw.Size, &raw.ETag,
		&created, &raw.CreatedBy.Id,
		&updated, &raw.UpdatedBy.Id,
		&syncSrc, &syncTime,
	}
	if r.WithBody {
		args = append(args, &raw.Body)
	}
	if r.WithSummary {
		args = append(args, &summary)
	}

	err := rows.Scan(args...)
	if err != nil {
		return nil, err
	}
	raw.Created = created.UnixMilli()
	raw.Updated = updated.UnixMilli()

	if syncSrc.Valid {
		raw.SyncSrc = syncSrc.String
	}
	if syncTime.Valid {
		raw.SyncTime = syncTime.Time.UnixMilli()
	}

	rsp := &object.ReadObjectResponse{
		Object: raw,
	}
	if summary != "" {
		rsp.SummaryJson = []byte(summary)
	}
	return rsp, nil
}

func (s sqlObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	modifier := object.UserFromContext(ctx)
	key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)

	args := []interface{}{key}
	where := "key=?"
	if r.Version != "" {
		args = append(args, r.Version)
		where = "key=? AND version=?"
	}

	rows, err := s.sess.Query(ctx, getReadSelect(r)+where, args...)
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return &object.ReadObjectResponse{}, nil
	}
	return rowToReadObjectResponse(rows, r)
}

func (s sqlObjectServer) BatchRead(ctx context.Context, b *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
	modifier := object.UserFromContext(ctx)

	args := []interface{}{}
	constraints := []string{}

	for _, r := range b.Batch {
		key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)
		where := "key=?"
		args = append(args, key)
		if r.Version != "" {
			args = append(args, r.Version)
			where = "(key=? AND version=?)"
		}
		constraints = append(constraints, where)
	}
	// TODO, validate everything has same WithBody/WithSummary
	req := b.Batch[0]
	query := getReadSelect(req) + strings.Join(constraints, " OR ")
	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	// TODO? make sure the results are in order?
	rsp := &object.BatchReadObjectResponse{}
	for rows.Next() {
		r, err := rowToReadObjectResponse(rows, req)
		if err != nil {
			return nil, err
		}
		rsp.Results = append(rsp.Results, r)
	}
	return rsp, nil
}

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
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

	modifier := object.UserFromContext(ctx)
	key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)

	rsp := &object.WriteObjectResponse{}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		rows, err := tx.Query(ctx, `SELECT "etag","version","updated","size" FROM object WHERE key=?`, key)
		if err != nil {
			return err
		}

		isUpdate := false
		timestamp := time.Now()
		versionInfo := &object.ObjectVersionInfo{
			Version: "1",
			Comment: r.Comment,
		}

		// Has a result
		if rows.Next() {
			update := time.Now()
			current := &object.ObjectVersionInfo{}
			rows.Scan(&current.ETag, &current.Version, &update, &current.Size)
			current.Updated = update.UnixMilli()

			if current.ETag == etag {
				rsp.Object = current // TODO more
				rsp.Status = object.WriteObjectResponse_UNCHANGED
				return nil
			}
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
		versionInfo.Size = int64(len(r.Body))
		versionInfo.ETag = etag
		versionInfo.Updated = timestamp.Unix()
		versionInfo.UpdatedBy = &object.UserInfo{
			Id:    modifier.UserID,
			Login: modifier.Login,
		}
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
		for k, v := range summary.Labels {
			_, err = tx.Exec(ctx, `INSERT INTO object_labels (`+
				`"object_key", "label", "value") `+
				`VALUES (?, ?, ?)`,
				key, k, v,
			)
			if err != nil {
				return err
			}
		}

		// 3. Add the references rows
		for _, ref := range summary.References {
			_, err = tx.Exec(ctx, `INSERT INTO object_ref (`+
				`"object_key", "kind", "type", "uid") `+
				`VALUES (?, ?, ?, ?)`,
				key, ref.Kind, ref.Type, ref.UID,
			)
			if err != nil {
				return err
			}
		}

		// 4. Add/update the main `object` table
		rsp.Object = versionInfo
		if isUpdate {
			rsp.Status = object.WriteObjectResponse_UPDATED
			_, err = tx.Exec(ctx, `UPDATE object SET "body"=?, "size"=?, "etag"=?, "version"=?, `+
				`"updated"=?, "updated_by"=?,`+
				`"name"=?, "description"=?, "summary"=? `+
				`WHERE key=?`,
				r.Body, versionInfo.Size, etag, versionInfo.Version,
				timestamp, modifier.UserID,
				summary.Name, summary.Description, string(summaryjson),
				key,
			)
			return err
		}

		// Insert the new row
		parent_folder_key := "???"

		_, err = tx.Exec(ctx, `INSERT INTO object (`+
			`"key", "parent_folder_key", "kind", "size", "body", "etag", "version",`+
			`"updated", "updated_by", "created", "created_by",`+
			`"name", "description", "summary") `+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
