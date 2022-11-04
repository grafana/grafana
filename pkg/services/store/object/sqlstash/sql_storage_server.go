package sqlstash

import (
	"context"
	"database/sql"
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
	"github.com/grafana/grafana/pkg/services/store/kind/folder"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/store/resolver"
	"github.com/grafana/grafana/pkg/services/store/router"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideSQLObjectServer(db db.DB, cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, kinds kind.KindRegistry, resolver resolver.ObjectReferenceResolver) object.ObjectStoreServer {
	objectServer := &sqlObjectServer{
		sess:     db.GetSqlxSession(),
		log:      log.New("sql-object-server"),
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
		"`key`", "kind", "version",
		"size", "etag", "errors", // errors are always returned
		"created_at", "created_by",
		"updated_at", "updated_by",
		"sync_src", "sync_time"}

	if r.WithBody {
		fields = append(fields, `body`)
	}
	if r.WithSummary {
		fields = append(fields, `name`, `description`, `labels`, `fields`)
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM object WHERE "
}

func (s *sqlObjectServer) rowToReadObjectResponse(ctx context.Context, rows *sql.Rows, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	key := "" // string (extract UID?)
	var syncSrc sql.NullString
	var syncTime sql.NullTime
	raw := &object.RawObject{
		GRN: &object.GRN{},
	}

	summaryjson := &summarySupport{}
	args := []interface{}{
		&key, &raw.GRN.Kind, &raw.Version,
		&raw.Size, &raw.ETag, &summaryjson.errors,
		&raw.Created, &raw.CreatedBy,
		&raw.Updated, &raw.UpdatedBy,
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

	if syncSrc.Valid || syncTime.Valid {
		raw.Sync = &object.RawObjectSyncInfo{
			Source: syncSrc.String,
			Time:   syncTime.Time.UnixMilli(),
		}
	}

	// Get the GRN from key.  TODO? save each part as a column?
	info, _ := s.router.RouteFromKey(ctx, key)
	if info.GRN != nil {
		raw.GRN = info.GRN
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

func (s *sqlObjectServer) getObjectKey(ctx context.Context, grn *object.GRN) (router.ResourceRouteInfo, error) {
	if grn == nil {
		return router.ResourceRouteInfo{}, fmt.Errorf("missing grn")
	}
	user := store.UserFromContext(ctx)
	if user == nil {
		return router.ResourceRouteInfo{}, fmt.Errorf("can not find user in context")
	}
	if user.OrgID != grn.TenantId {
		if grn.TenantId > 0 {
			return router.ResourceRouteInfo{}, fmt.Errorf("invalid user (wrong tenant id)")
		}
		grn.TenantId = user.OrgID
	}
	return s.router.Route(ctx, grn)
}

func (s *sqlObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	if r.Version != "" {
		return s.readFromHistory(ctx, r)
	}

	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	args := []interface{}{route.Key}
	where := "`key`=?"

	rows, err := s.sess.Query(ctx, getReadSelect(r)+where, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return &object.ReadObjectResponse{}, nil
	}

	return s.rowToReadObjectResponse(ctx, rows, r)
}

func (s *sqlObjectServer) readFromHistory(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	fields := []string{
		"body", "size", "etag",
		"updated_at", "updated_by",
	}

	rows, err := s.sess.Query(ctx,
		"SELECT "+strings.Join(fields, ",")+
			" FROM object_history WHERE `key`=? AND version=?", route.Key, r.Version)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	// Version or key not found
	if !rows.Next() {
		return &object.ReadObjectResponse{}, nil
	}

	raw := &object.RawObject{
		GRN: r.GRN,
	}
	rsp := &object.ReadObjectResponse{
		Object: raw,
	}
	err = rows.Scan(&raw.Body, &raw.Size, &raw.ETag, &raw.Updated, &raw.UpdatedBy)
	if err != nil {
		return nil, err
	}
	// For versioned files, the created+updated are the same
	raw.Created = raw.Updated
	raw.CreatedBy = raw.UpdatedBy
	raw.Version = r.Version // from the query

	// Dynamically create the summary
	if r.WithSummary {
		builder := s.kinds.GetSummaryBuilder(r.GRN.Kind)
		if builder != nil {
			val, out, err := builder(ctx, r.GRN.UID, raw.Body)
			if err == nil {
				raw.Body = out // cleaned up
				rsp.SummaryJson, err = json.Marshal(val)
				if err != nil {
					return nil, err
				}
			}
		}
	}

	// Clear the body if not requested
	if !r.WithBody {
		rsp.Object.Body = nil
	}

	return rsp, err
}

func (s *sqlObjectServer) BatchRead(ctx context.Context, b *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
	if len(b.Batch) < 1 {
		return nil, fmt.Errorf("missing querires")
	}

	first := b.Batch[0]
	args := []interface{}{}
	constraints := []string{}

	for _, r := range b.Batch {
		if r.WithBody != first.WithBody || r.WithSummary != first.WithSummary {
			return nil, fmt.Errorf("requests must want the same things")
		}

		route, err := s.getObjectKey(ctx, r.GRN)
		if err != nil {
			return nil, err
		}

		where := "`key`=?"
		args = append(args, route.Key)
		if r.Version != "" {
			return nil, fmt.Errorf("version not supported for batch read (yet?)")
		}
		constraints = append(constraints, where)
	}

	req := b.Batch[0]
	query := getReadSelect(req) + strings.Join(constraints, " OR ")
	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	// TODO? make sure the results are in order?
	rsp := &object.BatchReadObjectResponse{}
	for rows.Next() {
		r, err := s.rowToReadObjectResponse(ctx, rows, req)
		if err != nil {
			return nil, err
		}
		rsp.Results = append(rsp.Results, r)
	}
	return rsp, nil
}

func (s *sqlObjectServer) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	grn := route.GRN
	if grn == nil {
		return nil, fmt.Errorf("invalid grn")
	}

	modifier := store.UserFromContext(ctx)
	if modifier == nil {
		return nil, fmt.Errorf("can not find user in context")
	}

	summary, body, err := s.prepare(ctx, r)
	if err != nil {
		return nil, err
	}

	etag := createContentsHash(body)
	key := route.Key

	rsp := &object.WriteObjectResponse{
		GRN:    grn,
		Status: object.WriteObjectResponse_CREATED, // Will be changed if not true
	}

	// Make sure all parent folders exist
	if grn.Scope == models.ObjectStoreScopeDrive {
		err = s.ensureFolders(ctx, grn)
		if err != nil {
			return nil, err
		}
	}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		isUpdate := false
		versionInfo, err := s.selectForUpdate(ctx, tx, key)
		if err != nil {
			return err
		}

		// Same object
		if versionInfo.ETag == etag {
			rsp.Object = versionInfo
			rsp.Status = object.WriteObjectResponse_UNCHANGED
			return nil
		}

		// Optimistic locking
		if r.PreviousVersion != "" {
			if r.PreviousVersion != versionInfo.Version {
				return fmt.Errorf("optimistic lock failed")
			}
		}

		// Set the comment on this write
		timestamp := time.Now().UnixMilli()
		versionInfo.Comment = r.Comment
		if versionInfo.Version == "" {
			versionInfo.Version = "1"
		} else {
			// Increment the version
			i, _ := strconv.ParseInt(versionInfo.Version, 0, 64)
			if i < 1 {
				i = timestamp
			}
			versionInfo.Version = fmt.Sprintf("%d", i+1)
			isUpdate = true
		}

		if isUpdate {
			// Clear the labels+refs
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE `key`= ?", key); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE `key`= ?", key); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		versionInfo.Size = int64(len(body))
		versionInfo.ETag = etag
		versionInfo.Updated = timestamp
		versionInfo.UpdatedBy = store.GetUserIDString(modifier)
		_, err = tx.Exec(ctx, `INSERT INTO object_history (`+
			"`key`, `version`, `message`, "+
			"`size`, `body`, `etag`, "+
			"`updated_at`, `updated_by`) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			key, versionInfo.Version, versionInfo.Comment,
			versionInfo.Size, body, versionInfo.ETag,
			timestamp, versionInfo.UpdatedBy,
		)
		if err != nil {
			return err
		}

		// 2. Add the labels rows
		for k, v := range summary.model.Labels {
			_, err = tx.Exec(ctx, `INSERT INTO object_labels (`+
				"`key`, `label`, `value`) "+
				`VALUES (?, ?, ?)`,
				key, k, v,
			)
			if err != nil {
				return err
			}
		}

		// 3. Add the references rows
		for _, ref := range summary.model.References {
			resolved, err := s.resolver.Resolve(ctx, ref)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `INSERT INTO object_ref (`+
				"`key`, `kind`, `type`, `uid`, "+
				"`resolved_ok`, `resolved_to`, `resolved_warning`, `resolved_time`) "+
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				key, ref.Kind, ref.Type, ref.UID,
				resolved.OK, resolved.Key, resolved.Warning, resolved.Timestamp,
			)
			if err != nil {
				return err
			}
		}

		// 5. Add/update the main `object` table
		rsp.Object = versionInfo
		if isUpdate {
			rsp.Status = object.WriteObjectResponse_UPDATED
			_, err = tx.Exec(ctx, "UPDATE object SET "+
				"`body`=?, `size`=?, `etag`=?, `version`=?, "+
				"`updated_at`=?, `updated_by`=?,"+
				"`name`=?, `description`=?,"+
				"`labels`=?, `fields`=?, `errors`=? "+
				"WHERE `key`=?",
				body, versionInfo.Size, etag, versionInfo.Version,
				timestamp, versionInfo.UpdatedBy,
				summary.model.Name, summary.model.Description,
				summary.labels, summary.fields, summary.errors,
				key,
			)
			return err
		}

		// Insert the new row
		_, err = tx.Exec(ctx, "INSERT INTO object ("+
			"`key`, `parent_folder_key`, `kind`, `size`, `body`, `etag`, `version`,"+
			"`updated_at`, `updated_by`, `created_at`, `created_by`,"+
			"`name`, `description`,"+
			"`labels`, `fields`, `errors`) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			key, getParentFolderKey(grn.Kind, key), grn.Kind, versionInfo.Size, body, etag, versionInfo.Version,
			timestamp, versionInfo.UpdatedBy, timestamp, versionInfo.UpdatedBy, // created + updated are the same
			summary.model.Name, summary.model.Description,
			summary.labels, summary.fields, summary.errors,
		)
		return err
	})
	rsp.SummaryJson = summary.marshaled
	if err != nil {
		rsp.Status = object.WriteObjectResponse_ERROR
	}
	return rsp, err
}

func (s *sqlObjectServer) selectForUpdate(ctx context.Context, tx *session.SessionTx, key string) (*object.ObjectVersionInfo, error) {
	q := "SELECT etag,version,updated_at,size FROM object WHERE `key`=?"
	if false { // TODO, MYSQL/PosgreSQL can lock the row " FOR UPDATE"
		q += " FOR UPDATE"
	}
	rows, err := tx.Query(ctx, q, key)
	if err != nil {
		return nil, err
	}
	current := &object.ObjectVersionInfo{}
	if rows.Next() {
		err = rows.Scan(&current.ETag, &current.Version, &current.Updated, &current.Size)
	}
	if err == nil {
		err = rows.Close()
	}
	return current, err
}

func (s *sqlObjectServer) prepare(ctx context.Context, r *object.WriteObjectRequest) (*summarySupport, []byte, error) {
	grn := r.GRN
	builder := s.kinds.GetSummaryBuilder(grn.Kind)
	if builder == nil {
		return nil, nil, fmt.Errorf("unsupported kind")
	}

	summary, body, err := builder(ctx, grn.UID, r.Body)
	if err != nil {
		return nil, nil, err
	}

	summaryjson, err := newSummarySupport(summary)
	if err != nil {
		return nil, nil, err
	}
	return summaryjson, body, nil
}

func (s *sqlObjectServer) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	key := route.Key

	rsp := &object.DeleteObjectResponse{}
	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		results, err := tx.Exec(ctx, "DELETE FROM object WHERE `key`=?", key)
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
		_, _ = tx.Exec(ctx, "DELETE FROM object_history WHERE `key`=?", key)
		_, _ = tx.Exec(ctx, "DELETE FROM object_labels WHERE `key`=?", key)
		_, _ = tx.Exec(ctx, "DELETE FROM object_ref WHERE `key`=?", key)
		return nil
	})
	return rsp, err
}

func (s *sqlObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	key := route.Key

	page := ""
	args := []interface{}{key}
	if r.NextPageToken != "" {
		// args = append(args, r.NextPageToken) // TODO, need to get time from the version
		// page = "AND updated <= ?"
		return nil, fmt.Errorf("next page not supported yet")
	}

	query := "SELECT version,size,etag,updated_at,updated_by,message \n" +
		" FROM object_history \n" +
		" WHERE `key`=? " + page + "\n" +
		" ORDER BY updated_at DESC LIMIT 100"

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	rsp := &object.ObjectHistoryResponse{
		GRN: route.GRN,
	}
	for rows.Next() {
		v := &object.ObjectVersionInfo{}
		err := rows.Scan(&v.Version, &v.Size, &v.ETag, &v.Updated, &v.UpdatedBy, &v.Comment)
		if err != nil {
			return nil, err
		}
		rsp.Versions = append(rsp.Versions, v)
	}
	return rsp, err
}

func (s *sqlObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	user := store.UserFromContext(ctx)
	if r.NextPageToken != "" || len(r.Sort) > 0 || len(r.Labels) > 0 {
		return nil, fmt.Errorf("not yet supported")
	}

	fields := []string{
		"`key`", "kind", "version", "errors", // errors are always returned
		"updated_at", "updated_by",
		"name", "description", // basic summary
	}

	if r.WithBody {
		fields = append(fields, "body")
	}
	if r.WithLabels {
		fields = append(fields, "labels")
	}
	if r.WithFields {
		fields = append(fields, "fields")
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

	// Locked to a folder or prefix
	if r.Folder != "" {
		if r.Folder == models.ObjectStoreScopeEntity {
			return s.listEntityKinds(ctx)
		}

		if strings.HasSuffix(r.Folder, "/") {
			return nil, fmt.Errorf("folder should not end with slash")
		}
		if strings.HasSuffix(r.Folder, "*") {
			keyPrefix := fmt.Sprintf("%d/%s", user.OrgID, strings.ReplaceAll(r.Folder, "*", ""))
			selectQuery.addWherePrefix("key", keyPrefix)
		} else {
			keyPrefix := fmt.Sprintf("%d/%s", user.OrgID, r.Folder)
			selectQuery.addWhere("parent_folder_key", keyPrefix)
		}
	} else {
		keyPrefix := fmt.Sprintf("%d/", user.OrgID)
		selectQuery.addWherePrefix("key", keyPrefix)
	}

	query, args := selectQuery.toQuery()

	fmt.Printf("\n\n-------------\n")
	fmt.Printf("%s\n", query)
	fmt.Printf("%v\n", args)
	fmt.Printf("\n-------------\n\n")

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	key := ""
	rsp := &object.ObjectSearchResponse{}
	for rows.Next() {
		result := &object.ObjectSearchResult{
			GRN: &object.GRN{},
		}
		summaryjson := summarySupport{}

		args := []interface{}{
			&key, &result.GRN.Kind, &result.Version, &summaryjson.errors,
			&result.Updated, &result.UpdatedBy,
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

		info, err := s.router.RouteFromKey(ctx, key)
		if err != nil {
			return rsp, err
		}
		result.GRN = info.GRN

		// found one more than requested
		if len(rsp.Results) >= selectQuery.limit {
			// TODO? should this encode start+offset?
			rsp.NextPageToken = key
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

// This supports browsing the entity folder view
func (s *sqlObjectServer) listEntityKinds(ctx context.Context) (*object.ObjectSearchResponse, error) {
	kinds := []string{}

	rsp := &object.ObjectSearchResponse{}
	user := store.UserFromContext(ctx)
	query := `SELECT DISTINCT(kind) FROM object WHERE parent_folder_key LIKE "` + fmt.Sprintf("%d/%s", user.OrgID, models.ObjectStoreScopeEntity) + `%"`
	err := s.sess.Select(ctx, &kinds, query)
	if err == nil {
		for _, kind := range kinds {
			rsp.Results = append(rsp.Results, &object.ObjectSearchResult{
				GRN: &object.GRN{
					Scope: models.ObjectStoreScopeEntity,
					Kind:  models.StandardKindFolder,
					UID:   kind,
				},
				Name: kind,
			})
		}
	}
	return rsp, err
}

func (s *sqlObjectServer) ensureFolders(ctx context.Context, objectgrn *object.GRN) error {
	uid := objectgrn.UID
	idx := strings.LastIndex(uid, "/")
	var missing []*object.GRN

	for idx > 0 {
		parent := uid[:idx]
		grn := &object.GRN{
			TenantId: objectgrn.TenantId,
			Scope:    objectgrn.Scope,
			Kind:     models.StandardKindFolder,
			UID:      parent,
		}
		fr, err := s.router.Route(ctx, grn)
		if err != nil {
			return err
		}

		// Not super efficient, but maybe it is OK?
		results := []int64{}
		err = s.sess.Select(ctx, &results, "SELECT 1 from object WHERE `key`=?", fr.Key)
		if err != nil {
			return err
		}
		if len(results) == 0 {
			missing = append([]*object.GRN{grn}, missing...)
		}
		idx = strings.LastIndex(parent, "/")
	}

	// walk though each missing element
	for _, grn := range missing {
		f := &folder.Model{
			Name: store.GuessNameFromUID(grn.UID),
		}
		fmt.Printf("CREATE Folder: %s\n", grn.UID)
		body, err := json.Marshal(f)
		if err != nil {
			return err
		}
		_, err = s.Write(ctx, &object.WriteObjectRequest{
			GRN:  grn,
			Body: body,
		})
		if err != nil {
			return err
		}
	}
	return nil
}
