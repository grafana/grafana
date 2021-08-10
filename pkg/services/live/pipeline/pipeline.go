package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Pipeline struct {
	cache *Cache
}

func New(s Storage) *Pipeline {
	// TODO: temporary for development, remove.
	go postTestData()
	return &Pipeline{cache: NewCache(s)}
}

func (s *Pipeline) Get(orgID int64, channel string) (*LiveChannelRule, bool, error) {
	return s.cache.Get(orgID, channel)
}

type LiveChannelRule struct {
	OrgId      int64
	Pattern    string
	Mode       string
	Fields     []Field
	Processors []Processor
	Outputs    []Outputter
}

type Label struct {
	Name  string
	Value string // Can be JSONPath if starts with $.
}

type TimeOptions struct {
	Now    bool
	Format string
}

type Field struct {
	Name   string
	Type   data.FieldType
	Value  string // Can be JSONPath or Goja script.
	Labels []Label

	TimeOptions *TimeOptions
}

type ListLiveChannelRuleCommand struct {
	OrgId int64
}

type Storage interface {
	ListChannelRules(ctx context.Context, cmd ListLiveChannelRuleCommand) ([]*LiveChannelRule, error)
}

type Vars struct {
	OrgID int64
}

type ProcessorVars struct {
	Vars
	Scope     string
	Namespace string
	Path      string
}

type OutputVars struct {
	ProcessorVars
}
