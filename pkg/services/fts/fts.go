package fts

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/services/search/model"
)

// TODO: have staticallyt cmpiled indices via provideservice
type Service interface {
	Index(name string) Index
}

type Index interface {
	Init() error
	Update(...Document) error
	Search(string) ([]grn.GRN, error)
	Filter(string) model.FilterWhere
}

func ProvideService(db db.DB) Service {
	return &fts{db: db}
}

type fts struct {
	db db.DB
}

func (fts *fts) Index(name string) Index {
	// return &sqlIndex{db: fts.db, name: name}
	return &sqliteFTSIndex{db: fts.db, name: name}
}

// Document represents all indexable text data associated with a certain document identifier (GRN)
type Document struct {
	GRN    grn.GRN
	Fields []Field
}

// A Field is a name-value pair representing a single text entry of a document.
// One document may have multiple field with the same field name (i.e. panel titles).
type Field struct {
	Field string
	Value string
}
