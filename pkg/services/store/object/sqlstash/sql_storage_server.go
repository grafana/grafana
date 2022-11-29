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
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/grafana/grafana/pkg/services/store/resolver"
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
	}
	object.RegisterObjectStoreServer(grpcServerProvider.GetServer(), objectServer)
	return objectServer
}

type sqlObjectServer struct {
	log      log.Logger
	sess     *session.SessionDB
	kinds    kind.KindRegistry
	resolver resolver.ObjectReferenceResolver
}

func getReadSelect(r *object.ReadObjectRequest) string {
	fields := []string{
		"tenant_id", "kind", "uid", // The PK
		"version", "slug", "folder",
		"size", "etag", "errors", // errors are always returned
		"created_at", "created_by",
		"updated_at", "updated_by",
		"origin", "origin_key", "origin_ts"}

	if r.WithBody {
		fields = append(fields, `body`)
	}
	if r.WithSummary {
		fields = append(fields, `name`, `description`, `labels`, `fields`)
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM object WHERE "
}

func (s *sqlObjectServer) rowToReadObjectResponse(ctx context.Context, rows *sql.Rows, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	raw := &object.RawObject{
		GRN:    &object.GRN{},
		Origin: &object.ObjectOriginInfo{},
	}
	slug := ""

	summaryjson := &summarySupport{}
	args := []interface{}{
		&raw.GRN.TenantId, &raw.GRN.Kind, &raw.GRN.UID,
		&raw.Version, &slug, &raw.Folder,
		&raw.Size, &raw.ETag, &summaryjson.errors,
		&raw.CreatedAt, &raw.CreatedBy,
		&raw.UpdatedAt, &raw.UpdatedBy,
		&raw.Origin.Source, &raw.Origin.Key, &raw.Origin.Time,
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

	if raw.Origin.Source == "" {
		raw.Origin = nil
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

func (s *sqlObjectServer) validateGRN(ctx context.Context, grn *object.GRN) (*object.GRN, error) {
	if grn == nil {
		return nil, fmt.Errorf("missing GRN")
	}
	user := store.UserFromContext(ctx)
	if grn.TenantId == 0 {
		grn.TenantId = user.OrgID
	} else if grn.TenantId != user.OrgID {
		return nil, fmt.Errorf("tenant ID does not match userID")
	}
	return grn, nil
}

func (s *sqlObjectServer) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	if r.Version != "" {
		return s.readFromHistory(ctx, r)
	}
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	args := []interface{}{grn.ToOID()}
	where := "oid=?"

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
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToOID()

	fields := []string{
		"body", "size", "etag",
		"updated_at", "updated_by",
	}

	rows, err := s.sess.Query(ctx,
		"SELECT "+strings.Join(fields, ",")+
			" FROM object_history WHERE oid=? AND version=?", oid, r.Version)
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

		grn, err := s.validateGRN(ctx, r.GRN)
		if err != nil {
			return nil, err
		}

		oid := grn.ToOID()
		where := "oid=?"
		args = append(args, oid)
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
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToOID()

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

	slug := slugifyTitle(summary.name, r.GRN.UID)
	etag := createContentsHash(body)
	rsp := &object.WriteObjectResponse{
		GRN:    grn,
		Status: object.WriteObjectResponse_CREATED, // Will be changed if not true
	}
	origin := r.Origin
	if origin == nil {
		origin = &object.ObjectOriginInfo{}
	}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		var versionInfo *object.ObjectVersionInfo
		isUpdate := false
		if r.ClearHistory {
			// Optionally keep the original creation time information
			if createdAt < 1000 || createdBy == "" {
				err = s.fillCreationInfo(ctx, tx, oid, &createdAt, &createdBy)
				if err != nil {
					return err
				}
			}
			_, err = doDelete(ctx, tx, oid)
			if err != nil {
				return err
			}
			versionInfo = &object.ObjectVersionInfo{}
		} else {
			versionInfo, err = s.selectForUpdate(ctx, tx, oid)
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
			if _, err := tx.Exec(ctx, "DELETE FROM object_labels WHERE oid=?", oid); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM object_ref WHERE oid=?", oid); err != nil {
				return err
			}
		}

		// 1. Add the `object_history` values
		versionInfo.Size = int64(len(body))
		versionInfo.ETag = etag
		versionInfo.UpdatedAt = updatedAt
		versionInfo.UpdatedBy = updatedBy
		_, err = tx.Exec(ctx, `INSERT INTO object_history (`+
			"oid, version, message, "+
			"size, body, etag, "+
			"updated_at, updated_by) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			oid, versionInfo.Version, versionInfo.Comment,
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
					"(oid, label, value) "+
					`VALUES (?, ?, ?)`,
				oid, k, v,
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
				"oid, kind, type, uid, "+
				"resolved_ok, resolved_to, resolved_warning, resolved_time) "+
				`VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				oid, ref.Kind, ref.Type, ref.UID,
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
				"origin=?, origin_key=?, origin_ts=? "+
				"WHERE oid=?",
				body, versionInfo.Size, etag, versionInfo.Version,
				updatedAt, versionInfo.UpdatedBy,
				summary.model.Name, summary.model.Description,
				summary.labels, summary.fields, summary.errors,
				origin.Source, origin.Key, timestamp,
				oid,
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
			"oid, tenant_id, kind, uid, folder, "+
			"size, body, etag, version, "+
			"updated_at, updated_by, created_at, created_by, "+
			"name, description, slug, "+
			"labels, fields, errors, "+
			"origin, origin_key, origin_ts) "+
			"VALUES (?, ?, ?, ?, ?, "+
			" ?, ?, ?, ?, "+
			" ?, ?, ?, ?, "+
			" ?, ?, ?, "+
			" ?, ?, ?, "+
			" ?, ?, ?)",
			oid, grn.TenantId, grn.Kind, grn.UID, r.Folder,
			versionInfo.Size, body, etag, versionInfo.Version,
			updatedAt, createdBy, createdAt, createdBy, // created + updated are the same
			summary.model.Name, summary.model.Description, slug,
			summary.labels, summary.fields, summary.errors,
			origin.Source, origin.Key, origin.Time,
		)
		return err
	})
	rsp.SummaryJson = summary.marshaled
	if err != nil {
		rsp.Status = object.WriteObjectResponse_ERROR
	}
	return rsp, err
}

func (s *sqlObjectServer) fillCreationInfo(ctx context.Context, tx *session.SessionTx, oid string, createdAt *int64, createdBy *string) error {
	if *createdAt > 1000 {
		ignore := int64(0)
		createdAt = &ignore
	}
	if *createdBy == "" {
		ignore := ""
		createdBy = &ignore
	}

	rows, err := tx.Query(ctx, "SELECT created_at,created_by FROM object WHERE oid=?", oid)
	if err == nil {
		if rows.Next() {
			err = rows.Scan(&createdAt, &createdBy)
		}
		if err == nil {
			err = rows.Close()
		}
	}
	return err
}

func (s *sqlObjectServer) selectForUpdate(ctx context.Context, tx *session.SessionTx, oid string) (*object.ObjectVersionInfo, error) {
	q := "SELECT etag,version,updated_at,size FROM object WHERE oid=?"
	if false { // TODO, MYSQL/PosgreSQL can lock the row " FOR UPDATE"
		q += " FOR UPDATE"
	}
	rows, err := tx.Query(ctx, q, oid)
	if err != nil {
		return nil, err
	}
	current := &object.ObjectVersionInfo{}
	if rows.Next() {
		err = rows.Scan(&current.ETag, &current.Version, &current.UpdatedAt, &current.Size)
	}
	if err == nil {
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
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	rsp := &object.DeleteObjectResponse{}
	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		rsp.OK, err = doDelete(ctx, tx, grn.ToOID())
		return err
	})
	return rsp, err
}

func doDelete(ctx context.Context, tx *session.SessionTx, oid string) (bool, error) {
	results, err := tx.Exec(ctx, "DELETE FROM object WHERE oid=?", oid)
	if err != nil {
		return false, err
	}
	rows, err := results.RowsAffected()
	if err != nil {
		return false, err
	}

	// TODO: keep history? would need current version bump, and the "write" would have to get from history
	_, _ = tx.Exec(ctx, "DELETE FROM object_history WHERE oid=?", oid)
	_, _ = tx.Exec(ctx, "DELETE FROM object_labels WHERE oid=?", oid)
	_, _ = tx.Exec(ctx, "DELETE FROM object_ref WHERE oid=?", oid)
	return rows > 0, err
}

func (s *sqlObjectServer) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToOID()

	page := ""
	args := []interface{}{oid}
	if r.NextPageToken != "" {
		// args = append(args, r.NextPageToken) // TODO, need to get time from the version
		// page = "AND updated <= ?"
		return nil, fmt.Errorf("next page not supported yet")
	}

	query := "SELECT version,size,etag,updated_at,updated_by,message \n" +
		" FROM object_history \n" +
		" WHERE oid=? " + page + "\n" +
		" ORDER BY updated_at DESC LIMIT 100"

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	rsp := &object.ObjectHistoryResponse{
		GRN: r.GRN,
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
		"oid", "tenant_id", "kind", "uid",
		"version", "folder", "slug", "errors", // errors are always returned
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
	selectQuery.addWhere("tenant_id", user.OrgID)

	if len(r.Kind) > 0 {
		selectQuery.addWhereIn("kind", r.Kind)
	}

	// Folder UID or OID?
	if r.Folder != "" {
		selectQuery.addWhere("folder", r.Folder)
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
	oid := ""
	rsp := &object.ObjectSearchResponse{}
	for rows.Next() {
		result := &object.ObjectSearchResult{
			GRN: &object.GRN{},
		}
		summaryjson := summarySupport{}

		args := []interface{}{
			&oid, &result.GRN.TenantId, &result.GRN.Kind, &result.GRN.UID,
			&result.Version, &result.Folder, &result.Slug, &summaryjson.errors,
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

		// found one more than requested
		if len(rsp.Results) >= selectQuery.limit {
			// TODO? should this encode start+offset?
			rsp.NextPageToken = oid
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
