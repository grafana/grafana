package sqlstash

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/resolver"
	"github.com/grafana/grafana/pkg/setting"
)

// Make sure we implement both store + admin
var _ entity.EntityStoreServer = &sqlEntityServer{}
var _ entity.EntityStoreAdminServer = &sqlEntityServer{}

func ProvideSQLEntityServer(db db.DB, cfg *setting.Cfg, grpcServerProvider grpcserver.Provider, kinds kind.KindRegistry, resolver resolver.EntityReferenceResolver) entity.EntityStoreServer {
	entityServer := &sqlEntityServer{
		sess:     db.GetSqlxSession(),
		log:      log.New("sql-entity-server"),
		kinds:    kinds,
		resolver: resolver,
	}
	entity.RegisterEntityStoreServer(grpcServerProvider.GetServer(), entityServer)
	return entityServer
}

type sqlEntityServer struct {
	log      log.Logger
	sess     *session.SessionDB
	kinds    kind.KindRegistry
	resolver resolver.EntityReferenceResolver
}

func getReadSelect(r *entity.ReadEntityRequest) string {
	fields := []string{
		"tenant_id", "kind", "uid", "folder", // GRN + folder
		"version", "size", "etag", "errors", // errors are always returned
		"created_at", "created_by",
		"updated_at", "updated_by",
		"origin", "origin_key", "origin_ts"}

	if r.WithBody {
		fields = append(fields, `body`)
	}
	if r.WithSummary {
		fields = append(fields, "name", "slug", "description", "labels", "fields")
	}
	return "SELECT " + strings.Join(fields, ",") + " FROM entity WHERE "
}

func (s *sqlEntityServer) rowToReadEntityResponse(ctx context.Context, rows *sql.Rows, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	raw := &entity.Entity{
		GRN:    &entity.GRN{},
		Origin: &entity.EntityOriginInfo{},
	}

	summaryjson := &summarySupport{}
	args := []interface{}{
		&raw.GRN.TenantId, &raw.GRN.Kind, &raw.GRN.UID, &raw.Folder,
		&raw.Version, &raw.Size, &raw.ETag, &summaryjson.errors,
		&raw.CreatedAt, &raw.CreatedBy,
		&raw.UpdatedAt, &raw.UpdatedBy,
		&raw.Origin.Source, &raw.Origin.Key, &raw.Origin.Time,
	}
	if r.WithBody {
		args = append(args, &raw.Body)
	}
	if r.WithSummary {
		args = append(args, &summaryjson.name, &summaryjson.slug, &summaryjson.description, &summaryjson.labels, &summaryjson.fields)
	}

	err := rows.Scan(args...)
	if err != nil {
		return nil, err
	}

	if raw.Origin.Source == "" {
		raw.Origin = nil
	}

	if r.WithSummary || summaryjson.errors != nil {
		summary, err := summaryjson.toEntitySummary()
		if err != nil {
			return nil, err
		}

		js, err := json.Marshal(summary)
		if err != nil {
			return nil, err
		}
		raw.SummaryJson = js
	}
	return raw, nil
}

func (s *sqlEntityServer) validateGRN(ctx context.Context, grn *entity.GRN) (*entity.GRN, error) {
	if grn == nil {
		return nil, fmt.Errorf("missing GRN")
	}
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	if grn.TenantId == 0 {
		grn.TenantId = user.OrgID
	} else if grn.TenantId != user.OrgID {
		return nil, fmt.Errorf("tenant ID does not match userID")
	}

	if grn.Kind == "" {
		return nil, fmt.Errorf("GRN missing kind")
	}
	if grn.UID == "" {
		return nil, fmt.Errorf("GRN missing UID")
	}
	if len(grn.UID) > 40 {
		return nil, fmt.Errorf("GRN UID is too long (>40)")
	}
	if strings.ContainsAny(grn.UID, "/#$@?") {
		return nil, fmt.Errorf("invalid character in GRN")
	}
	return grn, nil
}

func (s *sqlEntityServer) Read(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	if r.Version != "" {
		return s.readFromHistory(ctx, r)
	}
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	args := []interface{}{grn.ToGRNString()}
	where := "grn=?"

	rows, err := s.sess.Query(ctx, getReadSelect(r)+where, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return &entity.Entity{}, nil
	}

	return s.rowToReadEntityResponse(ctx, rows, r)
}

func (s *sqlEntityServer) readFromHistory(ctx context.Context, r *entity.ReadEntityRequest) (*entity.Entity, error) {
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToGRNString()

	fields := []string{
		"body", "size", "etag",
		"updated_at", "updated_by",
	}

	rows, err := s.sess.Query(ctx,
		"SELECT "+strings.Join(fields, ",")+
			" FROM entity_history WHERE grn=? AND version=?", oid, r.Version)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	// Version or key not found
	if !rows.Next() {
		return &entity.Entity{}, nil
	}

	raw := &entity.Entity{
		GRN: r.GRN,
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
				raw.SummaryJson, err = json.Marshal(val)
				if err != nil {
					return nil, err
				}
			}
		}
	}

	// Clear the body if not requested
	if !r.WithBody {
		raw.Body = nil
	}

	return raw, err
}

func (s *sqlEntityServer) BatchRead(ctx context.Context, b *entity.BatchReadEntityRequest) (*entity.BatchReadEntityResponse, error) {
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

		where := "grn=?"
		args = append(args, grn.ToGRNString())
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
	rsp := &entity.BatchReadEntityResponse{}
	for rows.Next() {
		r, err := s.rowToReadEntityResponse(ctx, rows, req)
		if err != nil {
			return nil, err
		}
		rsp.Results = append(rsp.Results, r)
	}
	return rsp, nil
}

func (s *sqlEntityServer) Write(ctx context.Context, r *entity.WriteEntityRequest) (*entity.WriteEntityResponse, error) {
	return s.AdminWrite(ctx, entity.ToAdminWriteEntityRequest(r))
}

//nolint:gocyclo
func (s *sqlEntityServer) AdminWrite(ctx context.Context, r *entity.AdminWriteEntityRequest) (*entity.WriteEntityResponse, error) {
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToGRNString()

	timestamp := time.Now().UnixMilli()
	createdAt := r.CreatedAt
	createdBy := r.CreatedBy
	updatedAt := r.UpdatedAt
	updatedBy := r.UpdatedBy
	if updatedBy == "" {
		modifier, err := appcontext.User(ctx)
		if err != nil {
			return nil, err
		}
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

	var access []byte //
	etag := createContentsHash(body)
	rsp := &entity.WriteEntityResponse{
		GRN:    grn,
		Status: entity.WriteEntityResponse_CREATED, // Will be changed if not true
	}
	origin := r.Origin
	if origin == nil {
		origin = &entity.EntityOriginInfo{}
	}

	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		var versionInfo *entity.EntityVersionInfo
		isUpdate := false
		if r.ClearHistory {
			// Optionally keep the original creation time information
			if createdAt < 1000 || createdBy == "" {
				err = s.fillCreationInfo(ctx, tx, oid, &createdAt, &createdBy)
				if err != nil {
					return err
				}
			}
			_, err = doDelete(ctx, tx, grn)
			if err != nil {
				return err
			}
			versionInfo = &entity.EntityVersionInfo{}
		} else {
			versionInfo, err = s.selectForUpdate(ctx, tx, oid)
			if err != nil {
				return err
			}
		}

		// Same entity
		if versionInfo.ETag == etag {
			rsp.Entity = versionInfo
			rsp.Status = entity.WriteEntityResponse_UNCHANGED
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
			if _, err := tx.Exec(ctx, "DELETE FROM entity_labels WHERE grn=? OR parent_grn=?", oid, oid); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM entity_ref WHERE grn=? OR parent_grn=?", oid, oid); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "DELETE FROM entity_nested WHERE parent_grn=?", oid); err != nil {
				return err
			}
		}

		// 1. Add the `entity_history` values
		versionInfo.Size = int64(len(body))
		versionInfo.ETag = etag
		versionInfo.UpdatedAt = updatedAt
		versionInfo.UpdatedBy = updatedBy
		_, err = tx.Exec(ctx, `INSERT INTO entity_history (`+
			"grn, version, message, "+
			"size, body, etag, folder, access, "+
			"updated_at, updated_by) "+
			"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			oid, versionInfo.Version, versionInfo.Comment,
			versionInfo.Size, body, versionInfo.ETag, r.Folder, access,
			updatedAt, versionInfo.UpdatedBy,
		)
		if err != nil {
			return err
		}

		// 5. Add/update the main `entity` table
		rsp.Entity = versionInfo
		if isUpdate {
			rsp.Status = entity.WriteEntityResponse_UPDATED
			_, err = tx.Exec(ctx, "UPDATE entity SET "+
				"body=?, size=?, etag=?, version=?, "+
				"updated_at=?, updated_by=?,"+
				"name=?, description=?,"+
				"labels=?, fields=?, errors=?, "+
				"origin=?, origin_key=?, origin_ts=? "+
				"WHERE grn=?",
				body, versionInfo.Size, etag, versionInfo.Version,
				updatedAt, versionInfo.UpdatedBy,
				summary.model.Name, summary.model.Description,
				summary.labels, summary.fields, summary.errors,
				origin.Source, origin.Key, timestamp,
				oid,
			)
		} else {
			if createdAt < 1000 {
				createdAt = updatedAt
			}
			if createdBy == "" {
				createdBy = updatedBy
			}

			_, err = tx.Exec(ctx, "INSERT INTO entity ("+
				"grn, tenant_id, kind, uid, folder, "+
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
				updatedAt, createdBy, createdAt, createdBy,
				summary.model.Name, summary.model.Description, summary.model.Slug,
				summary.labels, summary.fields, summary.errors,
				origin.Source, origin.Key, origin.Time,
			)
		}
		if err == nil && entity.StandardKindFolder == r.GRN.Kind {
			err = updateFolderTree(ctx, tx, grn.TenantId)
		}
		if err == nil {
			summary.folder = r.Folder
			summary.parent_grn = grn
			return s.writeSearchInfo(ctx, tx, oid, summary)
		}
		return err
	})
	rsp.SummaryJson = summary.marshaled
	if err != nil {
		rsp.Status = entity.WriteEntityResponse_ERROR
	}
	return rsp, err
}

func (s *sqlEntityServer) fillCreationInfo(ctx context.Context, tx *session.SessionTx, grn string, createdAt *int64, createdBy *string) error {
	if *createdAt > 1000 {
		ignore := int64(0)
		createdAt = &ignore
	}
	if *createdBy == "" {
		ignore := ""
		createdBy = &ignore
	}

	rows, err := tx.Query(ctx, "SELECT created_at,created_by FROM entity WHERE grn=?", grn)
	if err != nil {
		return err
	}

	if rows.Next() {
		err = rows.Scan(&createdAt, &createdBy)
	}

	errClose := rows.Close()
	if err != nil {
		return err
	}
	return errClose
}

func (s *sqlEntityServer) selectForUpdate(ctx context.Context, tx *session.SessionTx, grn string) (*entity.EntityVersionInfo, error) {
	q := "SELECT etag,version,updated_at,size FROM entity WHERE grn=?"
	if false { // TODO, MYSQL/PosgreSQL can lock the row " FOR UPDATE"
		q += " FOR UPDATE"
	}
	rows, err := tx.Query(ctx, q, grn)
	if err != nil {
		return nil, err
	}
	current := &entity.EntityVersionInfo{}
	if rows.Next() {
		err = rows.Scan(&current.ETag, &current.Version, &current.UpdatedAt, &current.Size)
	}

	errClose := rows.Close()
	if err != nil {
		return nil, err
	}

	return current, errClose
}

func (s *sqlEntityServer) writeSearchInfo(
	ctx context.Context,
	tx *session.SessionTx,
	grn string,
	summary *summarySupport,
) error {
	parent_grn := summary.getParentGRN()

	// Add the labels rows
	for k, v := range summary.model.Labels {
		_, err := tx.Exec(ctx,
			`INSERT INTO entity_labels `+
				"(grn, label, value, parent_grn) "+
				`VALUES (?, ?, ?, ?)`,
			grn, k, v, parent_grn,
		)
		if err != nil {
			return err
		}
	}

	// Resolve references
	for _, ref := range summary.model.References {
		resolved, err := s.resolver.Resolve(ctx, ref)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO entity_ref (`+
			"grn, parent_grn, family, type, id, "+
			"resolved_ok, resolved_to, resolved_warning, resolved_time) "+
			`VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			grn, parent_grn, ref.Family, ref.Type, ref.Identifier,
			resolved.OK, resolved.Key, resolved.Warning, resolved.Timestamp,
		)
		if err != nil {
			return err
		}
	}

	// Traverse entities and insert refs
	if summary.model.Nested != nil {
		for _, childModel := range summary.model.Nested {
			grn = (&entity.GRN{
				TenantId: summary.parent_grn.TenantId,
				Kind:     childModel.Kind,
				UID:      childModel.UID, // append???
			}).ToGRNString()

			child, err := newSummarySupport(childModel)
			if err != nil {
				return err
			}
			child.isNested = true
			child.folder = summary.folder
			child.parent_grn = summary.parent_grn
			parent_grn := child.getParentGRN()

			_, err = tx.Exec(ctx, "INSERT INTO entity_nested ("+
				"parent_grn, grn, "+
				"tenant_id, kind, uid, folder, "+
				"name, description, "+
				"labels, fields, errors) "+
				"VALUES (?, ?,"+
				" ?, ?, ?, ?,"+
				" ?, ?,"+
				" ?, ?, ?)",
				*parent_grn, grn,
				summary.parent_grn.TenantId, childModel.Kind, childModel.UID, summary.folder,
				child.name, child.description,
				child.labels, child.fields, child.errors,
			)

			if err != nil {
				return err
			}

			err = s.writeSearchInfo(ctx, tx, grn, child)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *sqlEntityServer) prepare(ctx context.Context, r *entity.AdminWriteEntityRequest) (*summarySupport, []byte, error) {
	grn := r.GRN
	builder := s.kinds.GetSummaryBuilder(grn.Kind)
	if builder == nil {
		return nil, nil, fmt.Errorf("unsupported kind")
	}

	summary, body, err := builder(ctx, grn.UID, r.Body)
	if err != nil {
		return nil, nil, err
	}

	// Update a summary based on the name (unless the root suggested one)
	if summary.Slug == "" {
		t := summary.Name
		if t == "" {
			t = r.GRN.UID
		}
		summary.Slug = slugify.Slugify(t)
	}

	summaryjson, err := newSummarySupport(summary)
	if err != nil {
		return nil, nil, err
	}

	return summaryjson, body, nil
}

func (s *sqlEntityServer) Delete(ctx context.Context, r *entity.DeleteEntityRequest) (*entity.DeleteEntityResponse, error) {
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}

	rsp := &entity.DeleteEntityResponse{}
	err = s.sess.WithTransaction(ctx, func(tx *session.SessionTx) error {
		rsp.OK, err = doDelete(ctx, tx, grn)
		return err
	})
	return rsp, err
}

func doDelete(ctx context.Context, tx *session.SessionTx, grn *entity.GRN) (bool, error) {
	str := grn.ToGRNString()
	results, err := tx.Exec(ctx, "DELETE FROM entity WHERE grn=?", str)
	if err != nil {
		return false, err
	}
	rows, err := results.RowsAffected()
	if err != nil {
		return false, err
	}

	// TODO: keep history? would need current version bump, and the "write" would have to get from history
	_, err = tx.Exec(ctx, "DELETE FROM entity_history WHERE grn=?", str)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_labels WHERE grn=? OR parent_grn=?", str, str)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_ref WHERE grn=? OR parent_grn=?", str, str)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_nested WHERE parent_grn=?", str)
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, "DELETE FROM entity_access WHERE grn=?", str)
	if err != nil {
		return false, err
	}

	if grn.Kind == entity.StandardKindFolder {
		err = updateFolderTree(ctx, tx, grn.TenantId)
	}
	return rows > 0, err
}

func (s *sqlEntityServer) History(ctx context.Context, r *entity.EntityHistoryRequest) (*entity.EntityHistoryResponse, error) {
	grn, err := s.validateGRN(ctx, r.GRN)
	if err != nil {
		return nil, err
	}
	oid := grn.ToGRNString()

	page := ""
	args := []interface{}{oid}
	if r.NextPageToken != "" {
		// args = append(args, r.NextPageToken) // TODO, need to get time from the version
		// page = "AND updated <= ?"
		return nil, fmt.Errorf("next page not supported yet")
	}

	query := "SELECT version,size,etag,updated_at,updated_by,message \n" +
		" FROM entity_history \n" +
		" WHERE grn=? " + page + "\n" +
		" ORDER BY updated_at DESC LIMIT 100"

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	rsp := &entity.EntityHistoryResponse{
		GRN: r.GRN,
	}
	for rows.Next() {
		v := &entity.EntityVersionInfo{}
		err := rows.Scan(&v.Version, &v.Size, &v.ETag, &v.UpdatedAt, &v.UpdatedBy, &v.Comment)
		if err != nil {
			return nil, err
		}
		rsp.Versions = append(rsp.Versions, v)
	}
	return rsp, err
}

func (s *sqlEntityServer) Search(ctx context.Context, r *entity.EntitySearchRequest) (*entity.EntitySearchResponse, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, fmt.Errorf("missing user in context")
	}

	if r.NextPageToken != "" || len(r.Sort) > 0 {
		return nil, fmt.Errorf("not yet supported")
	}

	fields := []string{
		"grn", "tenant_id", "kind", "uid",
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

	entityQuery := selectQuery{
		fields:   fields,
		from:     "entity", // the table
		args:     []interface{}{},
		limit:    r.Limit,
		oneExtra: true, // request one more than the limit (and show next token if it exists)
	}
	entityQuery.addWhere("tenant_id", user.OrgID)

	if len(r.Kind) > 0 {
		entityQuery.addWhereIn("kind", r.Kind)
	}

	// Folder UID or OID?
	if r.Folder != "" {
		entityQuery.addWhere("folder", r.Folder)
	}

	if len(r.Labels) > 0 {
		var args []interface{}
		var conditions []string
		for labelKey, labelValue := range r.Labels {
			args = append(args, labelKey)
			args = append(args, labelValue)
			conditions = append(conditions, "(label = ? AND value = ?)")
		}
		joinedConditions := strings.Join(conditions, " OR ")
		query := "SELECT grn FROM entity_labels WHERE " + joinedConditions + " GROUP BY grn HAVING COUNT(label) = ?"
		args = append(args, len(r.Labels))

		entityQuery.addWhereInSubquery("grn", query, args)
	}

	query, args := entityQuery.toQuery()

	rows, err := s.sess.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	oid := ""
	rsp := &entity.EntitySearchResponse{}
	for rows.Next() {
		result := &entity.EntitySearchResult{
			GRN: &entity.GRN{},
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
		if int64(len(rsp.Results)) >= entityQuery.limit {
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

func (s *sqlEntityServer) Watch(*entity.EntityWatchRequest, entity.EntityStore_WatchServer) error {
	return fmt.Errorf("unimplemented")
}
