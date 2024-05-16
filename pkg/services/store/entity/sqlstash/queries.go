package sqlstash

import (
	"embed"
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

type sqlEntityRefFindRequest struct {
	*sqltemplate.SQLTemplate
	Request *entity.ReferenceRequest
	Entity  *withSerialized
}

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

type sqlEntityListFolderElementsRequest struct {
	*sqltemplate.SQLTemplate
	Group      string
	Resource   string
	Namespace  string
	FolderInfo *folderInfo
}

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

// TODO: remove once we start using these symbols. Prevents `unused` linter
// until the next PR.
var (
	_, _, _ = sqlEntityDelete, sqlEntityInsert, sqlEntityListFolderElements
	_, _, _ = sqlEntityUpdate, sqlEntityRead, sqlEntityFolderInsert
	_, _, _ = sqlEntityRefFind, sqlEntityLabelsDelete, sqlEntityLabelsInsert
	_, _, _ = sqlKindVersionInc, sqlKindVersionInsert, sqlKindVersionLock
	_, _    = sqlEntityFolderInsertRequest{}, sqlEntityFolderInsertRequestItem{}
	_, _    = sqlEntityRefFindRequest{}, sqlEntityLabelsInsertRequest{}
	_, _    = sqlEntityLabelsInsertRequest{}, sqlEntityLabelsDeleteRequest{}
	_, _    = sqlKindVersionLockRequest{}, sqlKindVersionIncRequest{}
	_, _    = sqlKindVersionInsertRequest{}, sqlEntityListFolderElementsRequest{}
	_, _    = sqlEntityReadRequest{}, sqlEntityDeleteRequest{}
	_, _    = sqlEntityInsertRequest{}, sqlEntityUpdateRequest{}
	_       = withSerialized{}
)
