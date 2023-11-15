package fts

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/search/model"
)

type Service interface {
	Init() error              // TODO: turn this into a schema/index migration
	Update(...Document) error // TODO: one method vs two methods (single insert + bulk insert)?
	Search(string) ([]DocumentID, error)
	Filter(string) model.FilterWhere // TODO: Should it be a join filter+where filter instead?
}

func ProvideService(db db.DB) Service {
	return ProvideServiceWithName(db, "fts")
}

func ProvideServiceWithName(db db.DB, name string) Service {
	return &sqliteFTS{db: db, name: name}
}

// DocumentID is a unique document identifier, consisting of an orgID, document kind and UID.
type DocumentID struct {
	OrgID int64
	Kind  string
	UID   string
}

// Document represents all indexable text data associated with a certain document identifier (GRN)
type Document struct {
	DocumentID
	Fields []Field
}

// A Field is a name-value pair representing a single text entry of a document.
// One document may have multiple field with the same field name (i.e. panel titles).
type Field struct {
	Field string
	Value string
}
