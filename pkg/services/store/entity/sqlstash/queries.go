package sqlstash

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"text/template"
	"time"

	"google.golang.org/protobuf/proto"

	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// Templates setup.
var (
	//go:embed data/*.sql
	sqlTemplatesFS embed.FS

	// all templates
	helpers = template.FuncMap{
		"listSep": helperListSep,
		"join":    helperJoin,
	}
	sqlTemplates = template.Must(template.New("sql").Funcs(helpers).ParseFS(sqlTemplatesFS, `data/*.sql`))
)

func mustTemplate(filename string) *template.Template {
	if t := sqlTemplates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// Templates.
var (
	sqlEntityDelete             = mustTemplate("entity_delete.sql")
	sqlEntityInsert             = mustTemplate("entity_insert.sql")
	sqlEntityListFolderElements = mustTemplate("entity_list_folder_elements.sql")
	sqlEntityRead               = mustTemplate("entity_read.sql")
	sqlEntityUpdate             = mustTemplate("entity_update.sql")

	sqlEntityFolderInsert = mustTemplate("entity_folder_insert.sql")

	sqlEntityLabelsDelete = mustTemplate("entity_labels_delete.sql")
	sqlEntityLabelsInsert = mustTemplate("entity_labels_insert.sql")

	sqlKindVersionGet    = mustTemplate("kind_version_get.sql")
	sqlKindVersionInc    = mustTemplate("kind_version_inc.sql")
	sqlKindVersionInsert = mustTemplate("kind_version_insert.sql")
	sqlKindVersionLock   = mustTemplate("kind_version_lock.sql")
)

// TxOptions.
var (
	ReadCommitted = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	}
	ReadCommittedRO = &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
		ReadOnly:  true,
	}
)

// SQLError is an error returned by the database, which includes additionally
// debugging information about what was sent to the database.
type SQLError struct {
	Err          error
	CallType     string // either Query, QueryRow or Exec
	TemplateName string
	Query        string
	RawQuery     string
	ScanDest     []any

	// potentially regulated information is not exported and only directly
	// available for local testing and local debugging purposes, making sure it
	// is never marshaled to JSON or any other serialization.

	arguments []any
}

func (e SQLError) Unwrap() error {
	return e.Err
}

func (e SQLError) Error() string {
	return fmt.Sprintf("%s: %s with %d input arguments and %d output "+
		"destination arguments: %v", e.TemplateName, e.CallType,
		len(e.arguments), len(e.ScanDest), e.Err)
}

// entity_folder table requests.

type sqlEntityFolderInsertRequest struct {
	*sqltemplate.SQLTemplate
	Items []*sqlEntityFolderInsertRequestItem
}

func (r sqlEntityFolderInsertRequest) Validate() error {
	return nil // TODO
}

type sqlEntityFolderInsertRequestItem struct {
	GUID      string
	Namespace string
	UID       string
	SlugPath  string
	JS        string
	Depth     int32
	Left      int32
	Right     int32
	Detached  bool
}

// entity_labels table requests.

type sqlEntityLabelsInsertRequest struct {
	*sqltemplate.SQLTemplate
	GUID   string
	Labels map[string]string
}

func (r sqlEntityLabelsInsertRequest) Validate() error {
	return nil // TODO
}

type sqlEntityLabelsDeleteRequest struct {
	*sqltemplate.SQLTemplate
	GUID       string
	KeepLabels []string
}

func (r sqlEntityLabelsDeleteRequest) Validate() error {
	return nil // TODO
}

// entity_kind table requests.

type returnsKindVersion struct {
	ResourceVersion int64
	CreatedAt       int64
	UpdatedAt       int64
}

func (r *returnsKindVersion) Results() (*returnsKindVersion, error) {
	return r, nil
}

type sqlKindVersionGetRequest struct {
	*sqltemplate.SQLTemplate
	Group    string
	Resource string
	*returnsKindVersion
}

func (r sqlKindVersionGetRequest) Validate() error {
	return nil // TODO
}

type sqlKindVersionLockRequest struct {
	*sqltemplate.SQLTemplate
	Group    string
	Resource string
	*returnsKindVersion
}

func (r sqlKindVersionLockRequest) Validate() error {
	return nil // TODO
}

type sqlKindVersionIncRequest struct {
	*sqltemplate.SQLTemplate
	Group           string
	Resource        string
	ResourceVersion int64
	UpdatedAt       int64
}

func (r sqlKindVersionIncRequest) Validate() error {
	return nil // TODO
}

type sqlKindVersionInsertRequest struct {
	*sqltemplate.SQLTemplate
	Group     string
	Resource  string
	CreatedAt int64
	UpdatedAt int64
}

func (r sqlKindVersionInsertRequest) Validate() error {
	return nil // TODO
}

// entity and entity_history tables requests.

type sqlEntityListFolderElementsRequest struct {
	*sqltemplate.SQLTemplate
	Group      string
	Resource   string
	Namespace  string
	FolderInfo *folderInfo
}

func (r sqlEntityListFolderElementsRequest) Validate() error {
	return nil // TODO
}

// sqlEntityReadRequest can be used to retrieve a row from either the "entity"
// or the "entity_history" tables. In particular, don't use this template
// directly. Instead, use the readEntity function, which provides all common use
// cases and proper database deserialization.
type sqlEntityReadRequest struct {
	*sqltemplate.SQLTemplate
	Key             *grafanaregistry.Key
	ResourceVersion int64
	SelectForUpdate bool
	returnsEntitySet
}

func (r sqlEntityReadRequest) Validate() error {
	return nil // TODO
}

type sqlEntityDeleteRequest struct {
	*sqltemplate.SQLTemplate
	Key *grafanaregistry.Key
}

func (r sqlEntityDeleteRequest) Validate() error {
	return nil // TODO
}

type sqlEntityInsertRequest struct {
	*sqltemplate.SQLTemplate
	Entity *returnsEntity

	// TableEntity, when true, means we will insert into table "entity", and
	// into table "entity_history" otherwise.
	TableEntity bool
}

func (r sqlEntityInsertRequest) Validate() error {
	return nil // TODO
}

type sqlEntityUpdateRequest struct {
	*sqltemplate.SQLTemplate
	Entity *returnsEntity
}

func (r sqlEntityUpdateRequest) Validate() error {
	return nil // TODO
}

// newEmptyEntity allocates a new entity.Entity and all its internal state to be
// ready for use.
func newEmptyEntity() *entity.Entity {
	return &entity.Entity{
		// we need to allocate all internal pointer types so that they
		// are readily available to be populated in the template
		Origin: new(entity.EntityOriginInfo),

		// we also set default empty values in slices and maps instead of nil to
		// provide the most consistent JSON representation fields that will be
		// serialized this way to the database.
		Labels: map[string]string{},
		Fields: map[string]string{},
		Errors: []*entity.EntityErrorInfo{},
	}
}

func cloneEntity(src *entity.Entity) *entity.Entity {
	ret := newEmptyEntity()
	proto.Merge(ret, src)

	return ret
}

// returnsEntitySet can be embedded in a request struct to provide automatic set
// returning of []*entity.Entity from the database, deserializing as needed. It
// should be embedded as a value type.
// Example struct:
//
//	type sqlMyRequest struct {
//		*sqltemplate.SQLTemplate
//		returnsEntitySet          // embedded value type, not pointer type
//		GUID               string // example argument
//		MaxResourceVersion int    // example argument
//	}
//
// Example struct usage::
//
//	req := sqlMyRequest{
//		SQLTemplate:        sqltemplate.New(myDialect),
//		returnsEntitySet:   newReturnsEntitySet(),
//		GUID:               "abc",
//		MaxResourceVersion: 1,
//	}
//	entities, err := query(myTx, myTmpl, req)
//
// Example usage in SQL template:
//
//	SELECT
//			{{ .Ident "guid"             | .Into .Entity.Guid }},
//			{{ .Ident "resource_version" | .Into .Entity.ResourceVersion }},
//			{{ .Ident "body"             | .Into .Entity.Body }}
//		FROM {{ .Ident "entity_history" }}
//		WHERE 1 = 1
//			AND {{ .Ident "guid" }}              = {{ .Arg .GUID }}
//			AND {{ .Ident "resource_version" }} <= {{ .Arg .MaxResourceVersion }}
//	;
type returnsEntitySet struct {
	Entity *returnsEntity
}

// newWithResults returns a new newWithResults.
func newReturnsEntitySet() returnsEntitySet {
	return returnsEntitySet{
		Entity: newReturnsEntity(),
	}
}

// Results is part of the implementation of sqltemplate.WithResults that
// deserializes the database data into an internal *entity.Entity, and then
// returns a deep copy of it.
func (e returnsEntitySet) Results() (*entity.Entity, error) {
	ent, err := e.Entity.Results()
	if err != nil {
		return nil, err
	}

	return cloneEntity(ent), nil
}

// returnsEntity is a wrapper that aids with database (de)serialization. It
// embeds a *entity.Entity to provide transparent access to all its fields, but
// overrides the ones that need database (de)serialization. It should be a named
// field in your request struct, with pointer type.
// Example struct:
//
//	type sqlMyRequest struct {
//		*sqltemplate.SQLTemplate
//		Entity          *returnsEntity // named field with pointer type
//		GUID            string         // example argument
//		ResourceVersion int            // example argument
//	}
//
// Example struct usage:
//
//	req := sqlMyRequest{
//		SQLTemplate:     sqltemplate.New(myDialect),
//		Entity:          newReturnsEntity(),
//		GUID:            "abc",
//		ResourceVersion: 1,
//	}
//	err := queryRow(myTx, myTmpl, req)
//	// check err here
//	err = req.Entity.unmarshal()
//	// check err, and you can now use req.Entity.Entity
//
// Example usage in SQL template:
//
//	SELECT
//			{{ .Ident "guid"             | .Into .Entity.Guid }},
//			{{ .Ident "resource_version" | .Into .Entity.ResourceVersion }},
//			{{ .Ident "body"             | .Into .Entity.Body }}
//		FROM {{ .Ident "entity" }}
//		WHERE 1 =1
//			AND {{ .Ident "guid" }}             = {{ .Arg .GUID }}
//			AND {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
//	;
type returnsEntity struct {
	*entity.Entity
	Labels []byte
	Fields []byte
	Errors []byte
}

func newReturnsEntity() *returnsEntity {
	return &returnsEntity{
		Entity: newEmptyEntity(),
	}
}

func (e *returnsEntity) Results() (*entity.Entity, error) {
	if err := e.unmarshal(); err != nil {
		return nil, err
	}

	return e.Entity, nil
}

// marshal serializes the fields from the wire protocol representation so they
// can be written to the database.
func (e *returnsEntity) marshal() error {
	var err error

	if len(e.Entity.Labels) == 0 {
		e.Labels = []byte{'{', '}'}
	} else {
		e.Labels, err = json.Marshal(e.Entity.Labels)
		if err != nil {
			return fmt.Errorf("serialize entity \"labels\" field: %w", err)
		}
	}

	if len(e.Entity.Fields) == 0 {
		e.Fields = []byte{'{', '}'}
	} else {
		e.Fields, err = json.Marshal(e.Entity.Fields)
		if err != nil {
			return fmt.Errorf("serialize entity \"fields\" field: %w", err)
		}
	}

	if len(e.Entity.Errors) == 0 {
		e.Errors = []byte{'[', ']'}
	} else {
		e.Errors, err = json.Marshal(e.Entity.Errors)
		if err != nil {
			return fmt.Errorf("serialize entity \"errors\" field: %w", err)
		}
	}

	return nil
}

// unmarshal deserializes the fields in the database representation so they can
// be written to the wire protocol.
func (e *returnsEntity) unmarshal() error {
	if len(e.Labels) > 0 {
		if err := json.Unmarshal(e.Labels, &e.Entity.Labels); err != nil {
			return fmt.Errorf("deserialize entity \"labels\" field: %w", err)
		}
	} else {
		e.Entity.Labels = map[string]string{}
	}

	if len(e.Fields) > 0 {
		if err := json.Unmarshal(e.Fields, &e.Entity.Fields); err != nil {
			return fmt.Errorf("deserialize entity \"fields\" field: %w", err)
		}
	} else {
		e.Entity.Fields = map[string]string{}
	}

	if len(e.Errors) > 0 {
		if err := json.Unmarshal(e.Errors, &e.Entity.Errors); err != nil {
			return fmt.Errorf("deserialize entity \"errors\" field: %w", err)
		}
	} else {
		e.Entity.Errors = []*entity.EntityErrorInfo{}
	}

	return nil
}

// readEntity returns the entity defined by the given key as it existed at
// version `asOfVersion`, if that value is greater than zero. The returned
// entity will have at most that version. If `asOfVersion` is zero, then the
// current version of that entity will be returned. If `optimisticLocking` is
// true, then the latest version of the entity will be retrieved and return an
// error if its version is not exactly `asOfVersion`. The option
// `selectForUpdate` will cause to acquire a row-level exclusive lock upon
// selecting it. `optimisticLocking` is ignored if `asOfVersion` is zero.
// Common errors to check:
//  1. ErrOptimisticLockingFailed: the latest version of the entity does not
//     match the value of `asOfVersion`.
//  2. ErrNotFound: the entity does not currently exist, did not exist at the
//     version of `asOfVersion` or was deleted.
func readEntity(
	ctx context.Context,
	x db.ContextExecer,
	d sqltemplate.Dialect,
	k *grafanaregistry.Key,
	asOfVersion int64,
	optimisticLocking bool,
	selectForUpdate bool,
) (*returnsEntity, error) {
	asOfVersion = max(asOfVersion, 0)
	optimisticLocking = optimisticLocking && asOfVersion != 0

	v := asOfVersion
	if optimisticLocking {
		// for optimistic locking, we will not ask for a specific version, but
		// instead retrieve the latest version from the table "entity" and
		// manually compare if it matches the given value of "asOfVersion".
		v = 0
	}

	readReq := sqlEntityReadRequest{
		SQLTemplate:      sqltemplate.New(d),
		Key:              k,
		ResourceVersion:  v,
		SelectForUpdate:  selectForUpdate,
		returnsEntitySet: newReturnsEntitySet(),
	}
	ent, err := queryRow(ctx, x, sqlEntityRead, readReq)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("read entity: %w", err)
	}

	if ent.Action == entity.Entity_DELETED {
		return nil, ErrNotFound
	}

	if optimisticLocking && asOfVersion != 0 && ent.ResourceVersion != asOfVersion {
		return nil, ErrOptimisticLockingFailed
	}

	return readReq.Entity, nil
}

// kindVersionAtomicInc atomically increases the version of a kind within a
// transaction.
func kindVersionAtomicInc(ctx context.Context, x db.ContextExecer, d sqltemplate.Dialect, group, resource string) (newVersion int64, err error) {
	now := time.Now().UnixMilli()

	// 1. Lock the kind and get the latest version
	lockReq := sqlKindVersionLockRequest{
		SQLTemplate:        sqltemplate.New(d),
		Group:              group,
		Resource:           resource,
		returnsKindVersion: new(returnsKindVersion),
	}
	kindv, err := queryRow(ctx, x, sqlKindVersionLock, lockReq)

	// if there wasn't a row associated with the given kind, we create one with
	// version 1
	if errors.Is(err, sql.ErrNoRows) {
		// NOTE: there is a marginal chance that we race with another writer
		// trying to create the same row. This is only possible when onboarding
		// a new (Group, Resource) to the cell, which should be very unlikely,
		// and the workaround is simply retrying. The alternative would be to
		// use INSERT ... ON CONFLICT DO UPDATE ..., but that creates a
		// requirement for support in Dialect only for this marginal case, and
		// we would rather keep Dialect as small as possible. Another
		// alternative is to simply check if the INSERT returns a DUPLICATE KEY
		// error and then retry the original SELECT, but that also adds some
		// complexity to the code. That would be preferrable to changing
		// Dialect, though. The current alternative, just retrying, seems to be
		// enough for now.
		insReq := sqlKindVersionInsertRequest{
			SQLTemplate: sqltemplate.New(d),
			Group:       group,
			Resource:    resource,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if _, err = exec(ctx, x, sqlKindVersionInsert, insReq); err != nil {
			return 0, fmt.Errorf("insert into kind_version: %w", err)
		}

		return 1, nil
	}

	if err != nil {
		return 0, fmt.Errorf("lock kind: %w", err)
	}

	incReq := sqlKindVersionIncRequest{
		SQLTemplate:     sqltemplate.New(d),
		Group:           group,
		Resource:        resource,
		ResourceVersion: kindv.ResourceVersion,
		UpdatedAt:       now,
	}
	if _, err = exec(ctx, x, sqlKindVersionInc, incReq); err != nil {
		return 0, fmt.Errorf("increase kind version: %w", err)
	}

	return kindv.ResourceVersion + 1, nil
}

// Template helpers.

// helperListSep is a helper that helps writing simpler loops in SQL templates.
// Example usage:
//
//	{{ $comma := listSep ", "  }}
//	{{ range .Values }}
//		{{/* here we put "-" on each end to remove extra white space */}}
//		{{- call $comma -}}
//		{{ .Value }}
//	{{ end }}
func helperListSep(sep string) func() string {
	var addSep bool

	return func() string {
		if addSep {
			return sep
		}
		addSep = true

		return ""
	}
}

func helperJoin(sep string, elems ...string) string {
	return strings.Join(elems, sep)
}
