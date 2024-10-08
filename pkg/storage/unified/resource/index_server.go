package resource

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"

	"github.com/blevesearch/bleve/v2"
	"google.golang.org/grpc"
)

type IndexServer struct {
	ResourceServer
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
func (is IndexServer) Search(ctx context.Context, req *SearchRequest) (*SearchResponse, error) {
	// TODO how do we get tenant?
	tenantId := "default"
	tenantIndex := is.index.shards[tenantId].index

	// TODO create search/browse interface and extract Bleve implementation
	query := bleve.NewBooleanQuery()

	// scope query to specific kind if provided
	if req.Kind != "" {
		kindQuery := bleve.NewTermQuery(req.Kind)
		kindQuery.SetField("Kind")
		query.AddMust(kindQuery)
	}

	//query := bleve.NewMatchAllQuery()
	queryString := bleve.NewQueryStringQuery(req.Query)
	query.AddMust(queryString)

	searchReq := bleve.SearchRequest{Query: query, Size: 25, Fields: []string{"Kind", "Metadata.Name", "Metadata.CreationTimestamp"}}

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
		summary["Name"] = hit.Fields["Metadata.Name"]
		// marshal the summary and append it to response results
		jsonBytes, err := json.Marshal(summary)
		if err != nil {
			return nil, err
		}
		response.SearchSummaries[i] = jsonBytes
	}

	return response, nil
}

func (is IndexServer) History(ctx context.Context, req *HistoryRequest) (*HistoryResponse, error) {
	return nil, nil
}

func (is IndexServer) Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error) {
	return nil, nil
}

// Load the index
func (is *IndexServer) Load(ctx context.Context) error {
	is.index = NewIndex(is.s, Opts{})
	err := is.index.Init(ctx)
	if err != nil {
		return err
	}
	return nil
}

// Watch resources for changes and update the index
func (is *IndexServer) Watch(ctx context.Context) error {
	rtList := fetchResourceTypes()
	for _, rt := range rtList {
		wr := &WatchRequest{
			Options: rt,
		}

		go func() {
			// TODO: handle error
			err := is.s.Watch(wr, is.ws)
			if err != nil {
				log.Printf("Error watching resource %v", err)
			}
		}()
	}
	return nil
}

// Init sets the resource server on the index server
// so we can call the resource server from the index server
// TODO: a chicken and egg problem - index server needs the resource server but the resource server is created with the index server
func (is *IndexServer) Init(ctx context.Context, rs *server) error {
	is.s = rs
	is.ws = &indexWatchServer{
		is:      is,
		context: ctx,
	}
	return nil
}

func NewResourceIndexServer() ResourceIndexServer {
	return &IndexServer{}
}

type ResourceIndexer interface {
	Index(ctx context.Context) (*Index, error)
}

type indexWatchServer struct {
	grpc.ServerStream
	context context.Context
	is      *IndexServer
}

func (f *indexWatchServer) Send(we *WatchEvent) error {
	if we.Type == WatchEvent_ADDED {
		return f.Add(we)
	}

	if we.Type == WatchEvent_DELETED {
		return f.Delete(we)
	}

	if we.Type == WatchEvent_MODIFIED {
		return f.Update(we)
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

func (f *indexWatchServer) Index() *Index {
	return f.is.index
}

func (f *indexWatchServer) Add(we *WatchEvent) error {
	data, err := getData(we.Resource)
	if err != nil {
		return err
	}
	err = f.Index().Index(f.context, data)
	if err != nil {
		return err
	}
	return nil
}

func (f *indexWatchServer) Delete(we *WatchEvent) error {
	// TODO: this seems flakey. Does a delete have a Resource or Previous?
	// both cases have happened ( maybe because Georges pr was reverted )
	rs := we.Resource
	if rs == nil {
		rs = we.Previous
	}
	if rs == nil {
		return errors.New("resource not found")
	}
	data, err := getData(rs)
	if err != nil {
		return err
	}
	err = f.Index().Delete(f.context, data.Uid, data.Key)
	if err != nil {
		return err
	}
	return nil
}

func (f *indexWatchServer) Update(we *WatchEvent) error {
	data, err := getData(we.Resource)
	if err != nil {
		return err
	}
	err = f.Index().Delete(f.context, data.Uid, data.Key)
	if err != nil {
		return err
	}
	err = f.Index().Index(f.context, data)
	if err != nil {
		return err
	}
	return nil
}

type Data struct {
	Key   *ResourceKey
	Value *ResourceWrapper
	Uid   string
}

func getGroup(r *Resource) string {
	v := strings.Split(r.ApiVersion, "/")
	if len(v) > 0 {
		return v[0]
	}
	return ""
}

func getData(wr *WatchEvent_Resource) (*Data, error) {
	r, err := getResource(wr.Value)
	if err != nil {
		return nil, err
	}

	key := &ResourceKey{
		Group:     getGroup(r),
		Resource:  r.Kind,
		Namespace: r.Metadata.Namespace,
		Name:      r.Metadata.Name,
	}

	value := &ResourceWrapper{
		ResourceVersion: wr.Version,
		Value:           wr.Value,
	}
	return &Data{Key: key, Value: value, Uid: r.Metadata.Uid}, nil
}
