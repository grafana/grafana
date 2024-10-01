package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/blevesearch/bleve/v2"
	"google.golang.org/grpc"
)

type indexServer struct {
	s     *server
	index *Index
	ws    *indexWatchServer
}

/*
TODO
1. Does the client only provide a bleve query string?
2. What SearchRequest fields do we need to fill in?
3. What are sensible defaults? Size? Sorting? Fields?
4. Response items are showing as base64 encoded JSON. Is this expected?
5. How do we get the tenant?
*/
func (is indexServer) Search(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
	fmt.Println(req.Query)

	// TODO how do we get tenant?
	tenant := "default"
	tenantIndex := is.index.shards[tenant].index

	// assume the query is a bleve query string for now
	//query := bleve.NewQueryStringQuery(req.Query)
	query := bleve.NewMatchAllQuery()
	searchReq := bleve.SearchRequest{Query: query, Size: 100, Fields: []string{"Kind", "Metadata.CreationTimestamp"}}

	res, err := tenantIndex.Search(&searchReq)
	if err != nil {
		return nil, err
	}

	response := &SearchResponse{}
	response.SearchSummaries = make([][]byte, len(res.Hits))
	for i, hit := range res.Hits {
		// create a summary
		summary := map[string]interface{}{}
		summary["Kind"] = hit.Fields["Kind"]
		summary["CreationTimestamp"] = hit.Fields["Metadata.CreationTimestamp"]
		// marshal the summary and append it to response results
		jsonBytes, err := json.Marshal(summary)
		if err != nil {
			return nil, err
		}
		response.SearchSummaries[i] = jsonBytes
	}

	return response, nil
}

func (is indexServer) History(ctx context.Context, req *HistoryRequest) (*HistoryResponse, error) {
	return nil, nil
}

func (is indexServer) Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error) {
	return nil, nil
}

func (is *indexServer) Index(ctx context.Context, req *IndexRequest) (*IndexResponse, error) {
	if req.Key == nil {
		is.index = NewIndex(is.s, Opts{})
		err := is.index.Init(ctx)
		if err != nil {
			return nil, err
		}
		return nil, nil
	}

	err := is.index.Index(ctx, &Data{Key: req.Key, Value: req.Value})
	if err != nil {
		return nil, err
	}
	return nil, nil
}

func (is indexServer) Delete(ctx context.Context, uid string, key *ResourceKey) error {
	err := is.index.Delete(ctx, uid, key)
	if err != nil {
		return err
	}
	return nil
}

// Init sets the resource server on the index server
// so we can call the resource server from the index server
// TODO: a chicken and egg problem - index server needs the resource server but the resource server is created with the index server
func (is *indexServer) Init(ctx context.Context, rs *server) error {
	is.s = rs
	is.ws = &indexWatchServer{
		is:      is,
		context: ctx,
	}
	// TODO: how to watch all resources?
	wr := &WatchRequest{
		Options: &ListOptions{
			Key: &ResourceKey{
				Group:    "playlist.grafana.app",
				Resource: "playlists",
			},
		},
	}
	// TODO: handle watch error
	var err error
	go func() {
		err = rs.Watch(wr, is.ws)
	}()
	return err
}

func NewResourceIndexServer() ResourceIndexServer {
	return &indexServer{}
}

type ResourceIndexer interface {
	ResourceIndexServer
	Init(context.Context, *server) error
	Delete(context.Context, string, *ResourceKey) error
}

type indexWatchServer struct {
	grpc.ServerStream
	context context.Context
	is      *indexServer
}

func (f *indexWatchServer) Send(we *WatchEvent) error {
	r, err := getResource(we.Resource.Value)
	if err != nil {
		return err
	}

	key := &ResourceKey{
		Group:     getGroup(r),
		Resource:  r.Kind,
		Namespace: r.Metadata.Namespace,
		Name:      r.Metadata.Name,
	}

	value := &ResourceWrapper{
		ResourceVersion: we.Resource.Version,
		Value:           we.Resource.Value,
	}

	index := f.is.s.index
	indexer, ok := index.(ResourceIndexer)
	if !ok {
		return errors.New("index server does not implement ResourceIndexer")
	}

	if we.Type == WatchEvent_ADDED {
		_, err = indexer.Index(f.context, &IndexRequest{Key: key, Value: value})
		if err != nil {
			return err
		}
		return nil
	}

	if we.Type == WatchEvent_DELETED {
		we.GetType()
		err = indexer.Delete(f.context, r.Metadata.Uid, key)
		if err != nil {
			return err
		}
		return nil
	}

	return nil
}

func (f *indexWatchServer) RecvMsg(m interface{}) error {
	return nil
}

func (f *indexWatchServer) SendMsg(m interface{}) error {
	return errors.New("not implemented")
}

func (f *indexWatchServer) Context() context.Context {
	if f.context == nil {
		f.context = context.Background()
	}
	return f.context
}

type Data struct {
	Key   *ResourceKey
	Value *ResourceWrapper
}

func getGroup(r *Resource) string {
	v := strings.Split(r.ApiVersion, "/")
	if len(v) > 0 {
		return v[0]
	}
	return ""
}
