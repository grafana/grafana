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

// Make sure we implement both store + admin
var _ object.ObjectStoreServer = &sqlObjectServer{}
var _ object.ObjectStoreAdminServer = &sqlObjectServer{}

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
		"path", "kind", "version",
		"size", "etag", "errors", // errors are always returned
		"created_at", "created_by",
		"updated_at", "updated_by",
		"origin", "origin_ts"}

	if r.WithBody {
		fields = append(fields, `body`)
	}
	if r.WithSummary {
		fields = append(fields, `name`, `description`, `labels`, `fields`)
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM object WHERE "
}

func (s *sqlObjectServer) rowToReadObjectResponse(ctx context.Context, rows *sql.Rows, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	path := "" // string (extract UID?)
	var origin sql.NullString
	originTime := int64(0)
	raw := &object.RawObject{
		GRN: &object.GRN{},
	}

	summaryjson := &summarySupport{}
	args := []interface{}{
		&path, &raw.GRN.Kind, &raw.Version,
		&raw.Size, &raw.ETag, &summaryjson.errors,
		&raw.CreatedAt, &raw.CreatedBy,
		&raw.UpdatedAt, &raw.UpdatedBy,
		&origin, &originTime,
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

	if origin.Valid {
		raw.Origin = &object.ObjectOriginInfo{
			Source: origin.String,
			Time:   originTime,
		}
	}

	// Get the GRN from key.  TODO? save each part as a column?
	info, _ := s.router.RouteFromKey(ctx, path)
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
	where := "path=?"

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
			" FROM object_history WHERE path=? AND version=?", route.Key, r.Version)
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
	err = rows.Scan(&raw.Body, &raw.Size, &raw.ETag, &raw.UpdatedAt, &raw.UpdatedBy)
	if err != nil {
		return nil, err
	}
	// For versioned files, the created+updated are the same
	raw.CreatedAt = raw.UpdatedAt
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

		where := "path=?"
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
	return s.AdminWrite(ctx, object.ToAdminWriteObjectRequest(r))
}

//nolint:gocyclo
func (s *sqlObjectServer) AdminWrite(ctx context.Context, r *object.AdminWriteObjectRequest) (*object.WriteObjectResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	grn := route.GRN
	if grn == nil {
		return nil, fmt.Errorf("invalid grn")
	}

	timestamp := time.Now().UnixMilli()
	createdAt := r.CreatedAt
	createdBy := r.CreatedBy
	updatedAt := r.UpdatedAt
	updatedBy := r.UpdatedBy
	if updatedBy == "" {
		modifier := store.UserFromContext(ctx)
		if modifier == nil {
			return nil, fmt.Errorf("can not find user in context")
		}
		updatedBy = store.GetUserIDString(modifier)
	}
	if updatedAt < 1000 {
		updatedAt = timestamp
	}

	summary, body, err := s.prepare(ctx, r)
	if err != nil {
		return nil, err
	}

	etag := createContentsHash(body)
	path := route.Key

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
		var versionInfo *object.ObjectVersionInfo
		isUpdate := false
		if r.ClearHistory {
			// Optionally keep the original creation time information
			if createdAt < 1000 || createdBy == "" {
				err = s.fillCreationInfo(ctx, tx, path, &createdAt, &createdBy)
				if err != nil {
					return err
				}
			}
			_, err = doDelete(ctx, tx, path)
			if err != nil {
				return err
			}
			versionInfo = &object.ObjectVersionInfo{}
		} else {
			versionInfo, err = s.selectForUpdate(ctx, tx, path)
			if err != nil {
				return err
			}
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
		versionInfo.Comment = r.Comment
		if r.Version == "" {
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
		} else {
			versionInfo.Version = r.Version
		}

		if isUpdate {
			// Clear the labels+refs
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE path=?", path); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE path=?", path); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		versionInfo.Size = int64(len(body))
		versionInfo.ETag = etag
		versionInfo.UpdatedAt = updatedAt
		versionInfo.UpdatedBy = updatedBy
		_, err = tx.Exec(ctx, `INSERT INTO object_history (`+
			"path, version, message, "+
			"size, body, etag, "+
			"updated_at, updated_by) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			path, versionInfo.Version, versionInfo.Comment,
			versionInfo.Size, body, versionInfo.ETag,
			updatedAt, versionInfo.UpdatedBy,
		)
		if err != nil {
			return err
		}

		// 2. Add the labels rows
		for k, v := range summary.model.Labels {
			_, err = tx.Exec(ctx,
				`INSERT INTO object_labels `+
					"(path, label, value) "+
					`VALUES (?, ?, ?)`,
				path, k, v,
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
				"path, kind, type, uid, "+
				"resolved_ok, resolved_to, resolved_warning, resolved_time) "+
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				path, ref.Kind, ref.Type, ref.UID,
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
				"body=?, size=?, etag=?, version=?, "+
				"updated_at=?, updated_by=?,"+
				"name=?, description=?,"+
				"labels=?, fields=?, errors=?, "+
				"origin=?, origin_ts=? "+
				"WHERE path=?",
				body, versionInfo.Size, etag, versionInfo.Version,
				updatedAt, versionInfo.UpdatedBy,
				summary.model.Name, summary.model.Description,
				summary.labels, summary.fields, summary.errors,
				r.Origin, timestamp,
				path,
			)
			return err
		}

		if createdAt < 1000 {
			createdAt = updatedAt
		}
		if createdBy == "" {
			createdBy = updatedBy
		}

		_, err = tx.Exec(ctx, "INSERT INTO object ("+
			"path, parent_folder_path, kind, size, body, etag, version, "+
			"updated_at, updated_by, created_at, created_by, "+
			"name, description, origin, origin_ts, "+
			"labels, fields, errors) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			path, getParentFolderPath(grn.Kind, path), grn.Kind, versionInfo.Size, body, etag, versionInfo.Version,
			updatedAt, createdBy, createdAt, createdBy, // created + updated are the same
			summary.model.Name, summary.model.Description, r.Origin, timestamp,
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

func (s *sqlObjectServer) fillCreationInfo(ctx context.Context, tx *session.SessionTx, path string, createdAt *int64, createdBy *string) error {
	if *createdAt > 1000 {
		ignore := int64(0)
		createdAt = &ignore
	}
	if *createdBy == "" {
		ignore := ""
		createdBy = &ignore
	}

	rows, err := tx.Query(ctx, "SELECT created_at,created_by FROM object WHERE path=?", path)
	if err == nil {
		if rows.Next() {
			err = rows.Scan(&createdAt, &createdBy)
		}
		if err == nil {
			//nolint:sqlclosecheck
			err = rows.Close()
		}
	}
	return err
}

func (s *sqlObjectServer) selectForUpdate(ctx context.Context, tx *session.SessionTx, path string) (*object.ObjectVersionInfo, error) {
	q := "SELECT etag,version,updated_at,size FROM object WHERE path=?"
	if false { // TODO, MYSQL/PosgreSQL can lock the row " FOR UPDATE"
		q += " FOR UPDATE"
	}
	rows, err := tx.Query(ctx, q, path)
	if err != nil {
		return nil, err
	}
	current := &object.ObjectVersionInfo{}
	if rows.Next() {
		err = rows.Scan(&current.ETag, &current.Version, &current.UpdatedAt, &current.Size)
	}
	if err == nil {
		//nolint:sqlclosecheck
		err = rows.Close()
	}
	return current, err
}

func (s *sqlObjectServer) prepare(ctx context.Context, r *object.AdminWriteObjectRequest) (*summarySupport, []byte, error) {
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
	path := route.Key

	rsp := &object.DeleteObjectResponse{}
	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		rsp.OK, err = doDelete(ctx, tx, path)
		return err
	})
	return rsp, err
}

func doDelete(ctx context.Context, tx *session.SessionTx, path string) (bool, error) {
	results, err := tx.Exec(ctx, "DELETE FROM object WHERE path=?", path)
	if err != nil {
		return false, err
	}
	rows, err := results.RowsAffected()
	if err != nil {
		return false, err
	}

	// TODO: keep history? would need current version bump, and the "write" would have to get from history
	_, _ = tx.Exec(ctx, "DELETE FROM object_history WHERE path=?", path)
	_, _ = tx.Exec(ctx, "DELETE FROM object_labels WHERE path=?", path)
	_, _ = tx.Exec(ctx, "DELETE FROM object_ref WHERE path=?", path)
	return rows > 0, err
}

func (s *sqlObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	route, err := s.getObjectKey(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	path := route.Key

	page := ""
	args := []interface{}{path}
	if r.NextPageToken != "" {
		// args = append(args, r.NextPageToken) // TODO, need to get time from the version
		// page = "AND updated <= ?"
		return nil, fmt.Errorf("next page not supported yet")
	}

	query := "SELECT version,size,etag,updated_at,updated_by,message \n" +
		" FROM object_history \n" +
		" WHERE path=? " + page + "\n" +
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
		err := rows.Scan(&v.Version, &v.Size, &v.ETag, &v.UpdatedAt, &v.UpdatedBy, &v.Comment)
		if err != nil {
			return nil, err
		}
		rsp.Versions = append(rsp.Versions, v)
	}
	return rsp, err
}

func (s *sqlObjectServer) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	user := store.UserFromContext(ctx)
	if user == nil {
		return nil, fmt.Errorf("missing user in context")
	}

	if r.NextPageToken != "" || len(r.Sort) > 0 || len(r.Labels) > 0 {
		return nil, fmt.Errorf("not yet supported")
	}

	fields := []string{
		"path", "kind", "version", "errors", // errors are always returned
		"size", "updated_at", "updated_by",
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
		if strings.HasSuffix(r.Folder, "/") {
			return nil, fmt.Errorf("folder should not end with slash")
		}
		if strings.HasSuffix(r.Folder, "*") {
			keyPrefix := fmt.Sprintf("%d/%s", user.OrgID, strings.ReplaceAll(r.Folder, "*", ""))
			selectQuery.addWherePrefix("path", keyPrefix)
		} else {
			keyPrefix := fmt.Sprintf("%d/%s", user.OrgID, r.Folder)
			selectQuery.addWhere("parent_folder_path", keyPrefix)
		}
	} else {
		keyPrefix := fmt.Sprintf("%d/", user.OrgID)
		selectQuery.addWherePrefix("path", keyPrefix)
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
			&result.Size, &result.UpdatedAt, &result.UpdatedBy,
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
		err = s.sess.Select(ctx, &results, "SELECT 1 from object WHERE path=?", fr.Key)
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
