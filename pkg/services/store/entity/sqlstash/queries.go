package sqlstash

import (
	"embed"
	_ "embed"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

// Templates.
var (
	//go:embed data
	templatesFs embed.FS

	// all templates
	templates = template.Must(template.ParseFS(templatesFs, `data/*.sql`))

	sqlEntityDelete             = getTemplate("entity_delete.sql")
	sqlEntityInsert             = getTemplate("entity_insert.sql")
	sqlEntityListFolderElements = getTemplate("entity_list_folder_elements.sql")
	sqlEntityUpdate             = getTemplate("entity_update.sql")
	sqlEntityRead               = getTemplate("entity_read.sql")

	sqlEntityFolderInsert = getTemplate("entity_folder_insert.sql")

	sqlEntityRefFind = getTemplate("entity_ref_find.sql")

	sqlEntityLabelsDelete = getTemplate("entity_labels_delete.sql")
	sqlEntityLabelsInsert = getTemplate("entity_labels_insert.sql")

	sqlKindVersionInc    = getTemplate("kind_version_inc.sql")
	sqlKindVersionInsert = getTemplate("kind_version_insert.sql")
	sqlKindVersionLock   = getTemplate("kind_version_lock.sql")
)

func getTemplate(filename string) *template.Template {
	if t := templates.Lookup(filename); t != nil {
		return t
	}
	panic(fmt.Sprintf("template file not found: %s", filename))
}

// entity_folder table requests.

type sqlEntityFolderInsertRequest struct {
	*sqltemplate.SQLTemplate
	Items []*sqlEntityFolderInsertRequestItem
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

// entity_ref table requests.

type sqlEntityRefFindRequest struct {
	*sqltemplate.SQLTemplate
	Request *entity.ReferenceRequest
	Entity  *withSerialized
}

// entity_labels table requests.

type sqlEntityLabelsInsertRequest struct {
	*sqltemplate.SQLTemplate
	GUID   string
	Labels map[string]string
}

type sqlEntityLabelsDeleteRequest struct {
	*sqltemplate.SQLTemplate
	GUID       string
	KeepLabels []string
}

// entity_kind table requests.

type sqlKindVersionLockRequest struct {
	*sqltemplate.SQLTemplate
	Group           string
	GroupVersion    string
	Resource        string
	ResourceVersion int64
}

type sqlKindVersionIncRequest struct {
	*sqltemplate.SQLTemplate
	Group           string
	GroupVersion    string
	Resource        string
	ResourceVersion int64
}

type sqlKindVersionInsertRequest struct {
	*sqltemplate.SQLTemplate
	Group        string
	GroupVersion string
	Resource     string
}

// entity and entity_history tables requests.

type sqlEntityListFolderElementsRequest struct {
	*sqltemplate.SQLTemplate
	Group      string
	Resource   string
	Namespace  string
	FolderInfo *folderInfo
}

// sqlEntityReadRequest can be used to retrieve a row from either the "entity"
// or the "entity_history" tables. In particular, don't use this template
// directly. Instead, use the readEntity function, which provides all common use
// cases and proper database deserialization.
type sqlEntityReadRequest struct {
	*sqltemplate.SQLTemplate
	Key             *entity.Key
	ResourceVersion int64
	SelectForUpdate bool
	Entity          *withSerialized
}

type sqlEntityDeleteRequest struct {
	*sqltemplate.SQLTemplate
	Key *entity.Key
}

type sqlEntityInsertRequest struct {
	*sqltemplate.SQLTemplate
	Entity *withSerialized

	// TableEntity, when true, means we will insert into table "entity", and
	// into table "entity_history" otherwise.
	TableEntity bool
}

type sqlEntityUpdateRequest struct {
	*sqltemplate.SQLTemplate
	Entity *withSerialized
}

// withSerialized provides access to the wire Entiity DTO as well as the
// serialized version of some of its fields suitable to be read from or written
// to the database.
type withSerialized struct {
	*entity.Entity

	Labels []byte
	Fields []byte
	Errors []byte
}

// TODO: remove once we start using the variables. Prevents `unused` linter.
var (
	_ = sqlEntityDelete
	_ = sqlEntityInsert
	_ = sqlEntityListFolderElements
	_ = sqlEntityUpdate
	_ = sqlEntityRead
	_ = sqlEntityFolderInsert
	_ = sqlEntityRefFind
	_ = sqlEntityLabelsDelete
	_ = sqlEntityLabelsInsert
	_ = sqlKindVersionInsert
	_ = sqlKindVersionInsert
	_ = sqlKindVersionLock

	_ = sqlEntityFolderInsertRequest{}
	_ = sqlEntityFolderInsertRequestItem{}
	_ = sqlEntityRefFindRequest{}
	_ = sqlEntityLabelsInsertRequest{}
	_ = sqlEntityLabelsInsertRequest{}
	_ = sqlEntityLabelsDeleteRequest{}
	_ = sqlKindVersionLockRequest{}
	_ = sqlKindVersionIncRequest{}
	_ = sqlKindVersionInsertRequest{}
	_ = sqlEntityListFolderElementsRequest{}
	_ = sqlEntityReadRequest{}
	_ = sqlEntityDeleteRequest{}
	_ = sqlEntityInsertRequest{}
	_ = sqlEntityUpdateRequest{}
	_ = withSerialized{}
)
