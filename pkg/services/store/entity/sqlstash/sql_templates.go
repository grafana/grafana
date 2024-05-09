package sqlstash

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"text/template"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash/sqltemplate"
)

// Embedded data.
var (
	//go:embed data/kind_version_lock.sql
	sqlKindVersionLockData string
	//go:embed data/kind_version_inc.sql
	sqlKindVersionIncData string
	//go:embed data/entity_insert.sql
	sqlEntityInsertData string
)

// Templates.
var (
	sqlKindVersionLock = template.Must(template.New("sql").
				Parse(sqlKindVersionLockData))
	sqlKindVersionInc = template.Must(template.New("sql").
				Parse(sqlKindVersionIncData))
	sqlEntityInsert = template.Must(template.New("sql").
			Parse(sqlEntityInsertData))
)

type sqlKindVersionLockRequest struct {
	sqltemplate.Dialect
	*sqltemplate.Args

	Entity *entity.Entity
}

type sqlKindVersionIncRequest struct {
	sqltemplate.Dialect
	*sqltemplate.Args

	Entity                  *entity.Entity
	PreviousResourceVersion int64
}

type sqlEntityInsertRequest struct {
	sqltemplate.Dialect
	*sqltemplate.Args

	Entity     *entity.Entity
	Serialized *entitySerializedData

	// TableEntity, when true, means we will insert into table "entity", and
	// into table "entity_history" otherwise.
	TableEntity bool
}

type entitySerializedData struct {
	Labels []byte
	Fields []byte
	Errors []byte
}

var (
	jsonEmptyObject = []byte{'{', '}'}
	jsonEmptyArray  = []byte{'[', ']'}
)

func newEntitySerializedData(e *entity.Entity) (*entitySerializedData, error) {
	d := new(entitySerializedData)
	var err error

	if len(e.Labels) == 0 {
		d.Labels = jsonEmptyObject

	} else {
		d.Labels, err = json.Marshal(e.Labels)
		if err != nil {
			return nil, fmt.Errorf("serialize entity \"labels\" field: %w", err)
		}
	}

	if len(e.Fields) == 0 {
		d.Fields = jsonEmptyObject

	} else {
		d.Fields, err = json.Marshal(e.Fields)
		if err != nil {
			return nil, fmt.Errorf("serialize entity \"fields\" field: %w", err)
		}
	}

	if len(e.Errors) == 0 {
		d.Errors = jsonEmptyArray

	} else {
		d.Errors, err = json.Marshal(e.Errors)
		if err != nil {
			return nil, fmt.Errorf("serialize entity \"errors\" field: %w", err)
		}
	}

	return d, nil
}
