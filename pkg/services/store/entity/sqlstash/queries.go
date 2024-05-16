package sqlstash

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
	"google.golang.org/protobuf/proto"
)

// Embedded data.
var (
	//go:embed data/entity_delete.sql
	sqlEntityDeleteData string
	//go:embed data/entity_insert.sql
	sqlEntityInsertData string
	//go:embed data/entity_list_folder_elements.sql
	sqlEntityListFolderElementsData string
	//go:embed data/entity_update.sql
	sqlEntityUpdateData string
	//go:embed data/entity_read.sql
	sqlEntityReadData string

	//go:embed data/entity_folder_insert.sql
	sqlEntityFolderInsertData string

	//go:embed data/entity_ref_find.sql
	sqlEntityRefFindData string

	//go:embed data/entity_labels_delete.sql
	sqlEntityLabelsDeleteData string
	//go:embed data/entity_labels_insert.sql
	sqlEntityLabelsInsertData string

	//go:embed data/kind_version_inc.sql
	sqlKindVersionIncData string
	//go:embed data/kind_version_insert.sql
	sqlKindVersionInsertData string
	//go:embed data/kind_version_lock.sql
	sqlKindVersionLockData string
)

// Templates.
var (
	sqlEntityDelete             = newSQLTemplate(sqlEntityDeleteData)
	sqlEntityInsert             = newSQLTemplate(sqlEntityInsertData)
	sqlEntityListFolderElements = newSQLTemplate(sqlEntityListFolderElementsData)
	sqlEntityUpdate             = newSQLTemplate(sqlEntityUpdateData)
	sqlEntityRead               = newSQLTemplate(sqlEntityReadData)

	sqlEntityFolderInsert = newSQLTemplate(sqlEntityFolderInsertData)

	sqlEntityRefFind = newSQLTemplate(sqlEntityRefFindData)

	sqlEntityLabelsDelete = newSQLTemplate(sqlEntityLabelsDeleteData)
	sqlEntityLabelsInsert = newSQLTemplate(sqlEntityLabelsInsertData)

	sqlKindVersionInc    = newSQLTemplate(sqlKindVersionIncData)
	sqlKindVersionInsert = newSQLTemplate(sqlKindVersionInsertData)
	sqlKindVersionLock   = newSQLTemplate(sqlKindVersionLockData)
)

func newSQLTemplate(text string) *template.Template {
	return template.Must(template.New("sql").Parse(text))
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

func (r sqlEntityRefFindRequest) Results() (*entity.Entity, error) {
	if err := r.Entity.unmarshal(); err != nil {
		return nil, fmt.Errorf("deserialize entity from db: %w", err)
	}

	return proto.Clone(r.Entity.Entity).(*entity.Entity), nil
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

func newWithSerialized() *withSerialized {
	return &withSerialized{
		Entity: &entity.Entity{
			// we need to allocate all internal pointer types so that they
			// are available to be populated in the template
			Origin: new(entity.EntityOriginInfo),
		},
	}
}

var (
	jsonEmptyObject = []byte{'{', '}'}
	jsonEmptyArray  = []byte{'[', ']'}
)

// marshal serializes the fields from the wire protocol representation so they
// can be written to the database.
func (e *withSerialized) marshal() error {
	var err error

	if len(e.Entity.Labels) == 0 {
		e.Labels = jsonEmptyObject
	} else {
		e.Labels, err = json.Marshal(e.Entity.Labels)
		if err != nil {
			return fmt.Errorf("serialize entity \"labels\" field: %w", err)
		}
	}

	if len(e.Entity.Fields) == 0 {
		e.Fields = jsonEmptyObject
	} else {
		e.Fields, err = json.Marshal(e.Entity.Fields)
		if err != nil {
			return fmt.Errorf("serialize entity \"fields\" field: %w", err)
		}
	}

	if len(e.Entity.Errors) == 0 {
		e.Errors = jsonEmptyArray
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
func (e *withSerialized) unmarshal() error {
	if len(e.Labels) > 0 {
		if err := json.Unmarshal(e.Labels, &e.Entity.Labels); err != nil {
			return fmt.Errorf("deserialize entity \"labels\" field: %w", err)
		}
	}

	if len(e.Fields) > 0 {
		if err := json.Unmarshal(e.Fields, &e.Entity.Fields); err != nil {
			return fmt.Errorf("deserialize entity \"fields\" field: %w", err)
		}
	}

	if len(e.Errors) > 0 {
		if err := json.Unmarshal(e.Errors, &e.Entity.Errors); err != nil {
			return fmt.Errorf("deserialize entity \"errors\" field: %w", err)
		}
	}

	return nil
}
