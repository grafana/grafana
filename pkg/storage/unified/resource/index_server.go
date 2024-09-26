package resource

import (
	"context"
)

type indexServer struct {
	s     *server
	index *Index
}

func (is indexServer) Search(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
	res := &SearchResponse{}
	return res, nil
}

func (is indexServer) History(ctx context.Context, req *HistoryRequest) (*HistoryResponse, error) {
	return nil, nil
}

func (is indexServer) Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error) {
	return nil, nil
}

func (is indexServer) Index(ctx context.Context, req *IndexRequest) (*IndexResponse, error) {
	is.index = NewIndex(is.s, Opts{})
	err := is.index.Init(ctx)
	if err != nil {
		return nil, err
	}
	return nil, nil
}

// Init sets the resource server on the index server
// so we can call the resouce server from the index server
// TODO: a chicken and egg problem - index server needs the resource server but the resource server is created with the index server
func (is *indexServer) Init(rs *server) {
	is.s = rs
}

func NewResourceIndexServer() ResourceIndexServer {
	return &indexServer{}
}

type ResourceIndexer interface {
	Init(*server)
}
