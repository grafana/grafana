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

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/store/resolver"
	"github.com/grafana/grafana/pkg/services/store/router"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideSQLObjectServer(db db.DB, cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, kinds kind.KindRegistry, resolver resolver.ObjectReferenceResolver) object.ObjectStoreServer {
	objectServer := &sqlObjectServer{
		sess:     db.GetSqlxSession(),
		log:      log.New("in-memory-object-server"),
		kinds:    kinds,
		resolver: resolver,
		router:   router.NewObjectStoreRouter(kinds),
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type sqlObjectServer struct {
	log      log.Logger
	sess     *session.SessionDB
	kinds    kind.KindRegistry
	resolver resolver.ObjectReferenceResolver
	router   router.ObjectStoreRouter
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

	if syncSrc.Valid || syncTime.Valid {
		raw.Sync = &object.RawObjectSyncInfo{
			Source: syncSrc.String,
			Time:   syncTime.Time.UnixMilli(),
		}
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
			return nil, err
		}
		rsp.SummaryJson = js
	}
	return rsp, nil
}

func (s sqlObjectServer) getRouteInfo(ctx context.Context, kind string, uid string) (router.ResourceRouteInfo, error) {
	modifier := store.UserFromContext(ctx)
	return s.router.Route(ctx, models.GRN{
		OrgID:     modifier.OrgID,
		Kind:      kind,
		UID:       uid,
		Namespace: "flat", // "drive",
	})
}

func (s sqlObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	route, err := s.getRouteInfo(ctx, r.Kind, r.UID)
	if err != nil {
		return nil, err
	}

	args := []interface{}{route.Key}
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
	args := []interface{}{}
	constraints := []string{}

	for _, r := range b.Batch {
		route, err := s.getRouteInfo(ctx, r.Kind, r.UID)
		if err != nil {
			return nil, err
		}

		where := "key=?"
		args = append(args, route.Key)
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
	route, err := s.getRouteInfo(ctx, r.Kind, r.UID)
	if err != nil {
		return nil, err
	}

	builder := s.kinds.GetSummaryBuilder(r.Kind)
	if builder == nil {
		return nil, fmt.Errorf("unsupported kind")
	}
	modifier := store.UserFromContext(ctx)
	if modifier == nil {
		return nil, fmt.Errorf("can not find user in context")
	}

	summary, body, err := builder(ctx, r.UID, r.Body)
	if err != nil {
		return nil, err
	}

	summaryjson, err := newSummarySupport(summary)
	if err != nil {
		return nil, err
	}
	etag := createContentsHash(body)
	key := route.Key

	rsp := &object.WriteObjectResponse{
		Status: object.WriteObjectResponse_CREATED, // Will be changed if not true
	}

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
			err = rows.Scan(&current.ETag, &current.Version, &update, &current.Size)
			if err != nil {
				return err
			}
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
		}
		if err := rows.Close(); err != nil {
			return err
		}

		if isUpdate {
			// Clear the labels+refs
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE key = ?", key); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE key = ?", key); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		versionInfo.Size = int64(len(body))
		versionInfo.ETag = etag
		versionInfo.Updated = timestamp.Unix()
		versionInfo.UpdatedBy = store.GetUserIDString(modifier)
		_, err = tx.Exec(ctx, `INSERT INTO object_history (`+
			`"key", "version", "message", `+
			`"size", "body", "etag", `+
			`"updated", "updated_by") `+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			key, versionInfo.Version, versionInfo.Comment,
			versionInfo.Size, body, versionInfo.ETag,
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
			resolved, err := s.resolver.Resolve(ctx, ref)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `INSERT INTO object_ref (`+
				`"key", "kind", "type", "uid", `+
				`"resolved_ok", "resolved_to", "resolved_warning", "resolved_time") `+
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				key, ref.Kind, ref.Type, ref.UID,
				resolved.OK, resolved.Key, resolved.Warning, resolved.Timestamp,
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
				body, versionInfo.Size, etag, versionInfo.Version,
				timestamp, modifier.UserID,
				summary.Name, summary.Description,
				summaryjson.labels, summaryjson.fields, summaryjson.errors,
				key,
			)
			return err
		}

		// Insert the new row
		_, err = tx.Exec(ctx, `INSERT INTO object (`+
			`"key", "parent_folder_key", "kind", "size", "body", "etag", "version",`+
			`"updated", "updated_by", "created", "created_by",`+
			`"name", "description",`+
			`"labels", "fields", "errors") `+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			key, getParentFolderKey(key), r.Kind, versionInfo.Size, body, etag, versionInfo.Version,
			timestamp, modifier.UserID, timestamp, modifier.UserID, // created + updated are the same
			summary.Name, summary.Description,
			summaryjson.labels, summaryjson.fields, summaryjson.errors,
		)
		return err
	})
	rsp.SummaryJson = summaryjson.marshaled
	if err != nil {
		rsp.Status = object.WriteObjectResponse_ERROR
	}
	return rsp, err
}

func (s sqlObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	modifier := store.UserFromContext(ctx)
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
	modifier := store.UserFromContext(ctx)
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
	user := store.UserFromContext(ctx)
	if r.NextPageToken != "" || len(r.Sort) > 0 || len(r.Labels) > 0 {
		return nil, fmt.Errorf("not yet supported")
	}

	fields := []string{
		`"key"`, `"kind"`, `"version"`, `"errors"`, // errors are always returned
		`"updated"`, `"updated_by"`,
		`"name"`, `"description"`, // basic summary
	}

	if r.WithBody {
		fields = append(fields, `"body"`)
	}
	if r.WithLabels {
		fields = append(fields, `"labels"`)
	}
	if r.WithFields {
		fields = append(fields, `"fields"`)
	}

	selectQuery := selectQuery{
		fields:   fields,
		from:     "object", // the table
		args:     []interface{}{},
		limit:    int(r.Limit),
		oneExtra: true, // request one more than the limit (and show next token if it exists)
	}

	if len(r.Kind) > 0 {
		selectQuery.addWhereIn("kind", r.Kind)
	}

	// Basic org constraint
	keyPrefix := fmt.Sprintf("%d/", user.OrgID)
	if r.Folder != "" {
		keyPrefix = fmt.Sprintf("%d/%s", user.OrgID, r.Folder)
	}
	selectQuery.addWherePrefix("key", keyPrefix)

	query, args := selectQuery.toQuery()

	fmt.Printf("\n\n-------------\n")
	fmt.Printf("%s\n", query)
	fmt.Printf("%v\n", args)
	fmt.Printf("\n-------------\n\n")

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	key := ""
	updated := time.Now()
	updatedByID := int64(0)

	rsp := &object.ObjectSearchResponse{}
	for rows.Next() {
		result := &object.ObjectSearchResult{}
		summaryjson := summarySupport{}

		args := []interface{}{
			&key, &result.Kind, &result.Version, &summaryjson.errors,
			&updated, &updatedByID,
			&result.Name, &summaryjson.description,
		}
		if r.WithBody {
			args = append(args, &result.Body)
		}
		if r.WithLabels {
			args = append(args, &summaryjson.labels)
		}
		if r.WithFields {
			args = append(args, &summaryjson.fields)
		}

		err = rows.Scan(args...)
		if err != nil {
			return rsp, err
		}

		result.UID = "TODO!" + key

		// found one more than requested
		if len(rsp.Results) >= selectQuery.limit {
			// TODO? should this encode start+offset?
			rsp.NextPageToken = result.UID
			break
		}

		if summaryjson.description != nil {
			result.Description = *summaryjson.description
		}

		if summaryjson.labels != nil {
			b := []byte(*summaryjson.labels)
			err = json.Unmarshal(b, &result.Labels)
			if err != nil {
				return rsp, err
			}
		}

		if summaryjson.fields != nil {
			result.FieldsJson = []byte(*summaryjson.fields)
		}

		if summaryjson.errors != nil {
			result.ErrorJson = []byte(*summaryjson.errors)
		}

		rsp.Results = append(rsp.Results, result)
	}
	return rsp, err
}
