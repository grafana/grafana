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
		`"size"`, `"etag"`, `"errors"`, // errors are always returned
		`"created"`, `"created_by"`,
		`"updated"`, `"updated_by"`,
		`"sync_src"`, `"sync_time"`}

	if r.WithBody {
		fields = append(fields, `"body"`)
	}
	if r.WithSummary {
		fields = append(fields, `"name"`, `"description"`, `"labels"`, `"fields"`)
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM object WHERE "
}

func rowToReadObjectResponse(rows *sql.Rows, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	created := time.Now()
	updated := time.Now()
	key := "" // string (extract UID?)
	var syncSrc sql.NullString
	var syncTime sql.NullTime
	createdByID := int64(0)
	updatedByID := int64(0)
	raw := &object.RawObject{}

	summaryjson := &summarySupport{}

	args := []interface{}{
		&key, &raw.Kind, &raw.Version,
		&raw.Size, &raw.ETag, &summaryjson.errors,
		&created, &createdByID,
		&updated, &updatedByID,
		&syncSrc, &syncTime,
	}
	if r.WithBody {
		args = append(args, &raw.Body)
	}
	if r.WithSummary {
		args = append(args, &summaryjson.name, &summaryjson.description, &summaryjson.labels, &summaryjson.fields)
	}

	err := rows.Scan(args...)
	if err != nil {
		return nil, err
	}
	raw.Created = created.UnixMilli()
	raw.Updated = updated.UnixMilli()
	raw.CreatedBy = fmt.Sprintf("user:%d", updatedByID)
	raw.UpdatedBy = fmt.Sprintf("user:%d", updatedByID)

	if syncSrc.Valid {
		raw.SyncSrc = syncSrc.String
	}
	if syncTime.Valid {
		raw.SyncTime = syncTime.Time.UnixMilli()
	}

	rsp := &object.ReadObjectResponse{
		Object: raw,
	}

	if r.WithSummary || summaryjson.errors != nil {
		summary, err := summaryjson.toObjectSummary()
		if err != nil {
			return nil, err
		}

		js, err := json.Marshal(summary)
		if err != nil {
			rsp.SummaryJson = js
		}
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
		Description: fmt.Sprintf("Wrote at %s", time.Now().Local().String()),
		Labels: map[string]string{
			"hello": "world",
			"test":  "",
		},
		Fields: map[string]interface{}{
			"field1": "a string",
			"field2": 1.224,
			"field4": true,
		},
		Error:  nil, // ignore for now
		Nested: nil, // ignore for now
		References: []*object.ExternalReference{
			{
				Kind: "ds",
				Type: "influx",
				UID:  "xyz",
			},
			{
				Kind: "panel",
				Type: "heatmap",
			},
			{
				Kind: "panel",
				Type: "timeseries",
			},
		},
	}

	summaryjson, err := newSummarySupport(&summary)
	if err != nil {
		return nil, err
	}
	etag := createContentsHash(r.Body)

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
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE key = ?", key); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE key = ?", key); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		versionInfo.Size = int64(len(r.Body))
		versionInfo.ETag = etag
		versionInfo.Updated = timestamp.Unix()
		versionInfo.UpdatedBy = object.GetUserIDString(modifier)
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
				`"key", "label", "value") `+
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
				`"key", "kind", "type", "uid") `+
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
				`"name"=?, "description"=?,`+
				`"labels"=?, "fields"=?, "errors"=? `+
				`WHERE key=?`,
				r.Body, versionInfo.Size, etag, versionInfo.Version,
				timestamp, modifier.UserID,
				summary.Name, summary.Description,
				summaryjson.labels, summaryjson.fields, summaryjson.errors,
				key,
			)
			return err
		}

		// Insert the new row
		parent_folder_key := "???"

		_, err = tx.Exec(ctx, `INSERT INTO object (`+
			`"key", "parent_folder_key", "kind", "size", "body", "etag", "version",`+
			`"updated", "updated_by", "created", "created_by",`+
			`"name", "description",`+
			`"labels", "fields", "errors") `+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			key, parent_folder_key, r.Kind, versionInfo.Size, r.Body, etag, versionInfo.Version,
			timestamp, modifier.UserID, timestamp, modifier.UserID, // created + modified
			summary.Name, summary.Description,
			summaryjson.labels, summaryjson.fields, summaryjson.errors,
		)
		if err != nil {
			rsp.Status = object.WriteObjectResponse_CREATED
		}
		return err
	})

	return rsp, err
}

func (s sqlObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	modifier := object.UserFromContext(ctx)
	key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)

	rsp := &object.DeleteObjectResponse{}
	err := s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		results, err := tx.Exec(ctx, `DELETE FROM object key=?`, key)
		if err != nil {
			return err
		}
		rows, err := results.RowsAffected()
		if err != nil {
			return err
		}
		if rows > 0 {
			rsp.OK = true
		}

		// TODO: keep history? would need current version bump, and the "write" would have to get from history
		_, _ = tx.Exec(ctx, `DELETE FROM object_history key=?`, key)
		_, _ = tx.Exec(ctx, `DELETE FROM object_labels key=?`, key)
		_, _ = tx.Exec(ctx, `DELETE FROM object_ref key=?`, key)
		return nil
	})
	return rsp, err
}

func (s sqlObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	modifier := object.UserFromContext(ctx)
	key := fmt.Sprintf("%d/%s.%s", modifier.OrgID, r.UID, r.Kind)

	page := ""
	args := []interface{}{key}
	if r.NextPageToken != "" {
		args = append(args, r.NextPageToken) // TODO, need to get time from the version
		page = "AND updated <= ?"
	}

	// TODO limiting...
	query := `SELECT "version","size","etag","updated","updated_by","message" 
		FROM object_history
		WHERE "key"=? ` + page + `
		ORDER BY "updated" DESC
	;`

	timestamp := time.Now()
	updateById := int64(0)
	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	rsp := &object.ObjectHistoryResponse{}
	for rows.Next() {
		v := &object.ObjectVersionInfo{}
		err := rows.Scan(&v.Version, &v.Size, &v.ETag, &timestamp, &updateById, &v.Comment)
		if err != nil {
			return nil, err
		}
		v.Updated = timestamp.UnixMilli()
		v.UpdatedBy = fmt.Sprintf("user:%d", updateById)
		rsp.Versions = append(rsp.Versions, v)
	}
	return rsp, err
}

func (s sqlObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	if r.NextPageToken != "" || r.Folder != "" || len(r.Sort) > 0 {
		return nil, fmt.Errorf("not yet supported")
	}

	return nil, fmt.Errorf("not implemented yet")
}
