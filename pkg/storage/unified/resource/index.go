package resource

import (
	"context"
	"encoding/json"
	"fmt"
	golog "log"
	"os"

	"github.com/blevesearch/bleve/v2"
	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/log"
)

type Shard struct {
	index bleve.Index
	path  string
	batch *bleve.Batch
}

type Index struct {
	shards map[string]Shard
	opts   Opts
	s      *server
	log    log.Logger
}

func NewIndex(s *server, opts Opts) *Index {
	idx := &Index{
		s:      s,
		opts:   opts,
		shards: make(map[string]Shard),
		log:    log.New("unifiedstorage.search.index"),
	}
	return idx
}

func (i *Index) IndexBatch(list *ListResponse, kind string) error {
	for _, obj := range list.Items {
		res, err := getResource(obj.Value)
		if err != nil {
			return err
		}

		shard, err := i.getShard(tenant(res))
		if err != nil {
			return err
		}
		i.log.Debug("initial indexing resources batch", "count", len(list.Items), "kind", kind, "tenant", tenant(res))

		// Transform the raw resource into a more generic indexable resource
		indexableResource, err := NewIndexedResource(obj.Value)
		if err != nil {
			return err
		}

		err = shard.batch.Index(res.Metadata.Uid, indexableResource)
		if err != nil {
			return err
		}
	}

	for _, shard := range i.shards {
		err := shard.index.Batch(shard.batch)
		if err != nil {
			return err
		}
		shard.batch.Reset()
	}

	return nil
}

func (i *Index) Init(ctx context.Context) error {
	resourceTypes := fetchResourceTypes()
	for _, rt := range resourceTypes {
		i.log.Info("indexing resource", "kind", rt.Key.Resource)
		r := &ListRequest{Options: rt, Limit: 100}

		// Paginate through the list of resources and index each page
		for {
			list, err := i.s.List(ctx, r)
			if err != nil {
				return err
			}

			// Index current page
			err = i.IndexBatch(list, rt.Key.Resource)
			if err != nil {
				return err
			}

			if list.NextPageToken == "" {
				break
			}

			r.NextPageToken = list.NextPageToken
		}
	}

	return nil
}

func (i *Index) Index(ctx context.Context, data *Data) error {
	res, err := getResource(data.Value.Value)
	if err != nil {
		return err
	}
	tenant := tenant(res)
	i.log.Debug("indexing resource for tenant", "res", res, "tenant", tenant)
	shard, err := i.getShard(tenant)
	if err != nil {
		return err
	}
	// Transform the raw resource into a more generic indexable resource
	indexableResource, err := NewIndexedResource(data.Value.Value)
	if err != nil {
		return err
	}
	err = shard.index.Index(res.Metadata.Uid, indexableResource)
	if err != nil {
		return err
	}
	return nil
}

func (i *Index) Delete(ctx context.Context, uid string, key *ResourceKey) error {
	shard, err := i.getShard(key.Namespace)
	if err != nil {
		return err
	}
	err = shard.index.Delete(uid)
	if err != nil {
		return err
	}
	return nil
}

func (i *Index) Search(ctx context.Context, tenant string, query string, limit int, offset int) ([]IndexedResource, error) {
	if tenant == "" {
		tenant = "default"
	}
	shard, err := i.getShard(tenant)
	if err != nil {
		return nil, err
	}
	docCount, err := shard.index.DocCount()
	if err != nil {
		return nil, err
	}
	i.log.Info("got index for tenant", "tenant", tenant, "docCount", docCount)

	fields, _ := shard.index.Fields()
	i.log.Debug("indexed fields", "fields", fields)

	// use 10 as a default limit for now
	if limit <= 0 {
		limit = 10
	}

	req := bleve.NewSearchRequest(bleve.NewQueryStringQuery(query))
	req.From = offset
	req.Size = limit

	req.Fields = []string{"*"} // return all indexed fields in search results

	i.log.Info("searching index", "query", query, "tenant", tenant)
	res, err := shard.index.Search(req)
	if err != nil {
		return nil, err
	}
	hits := res.Hits

	i.log.Info("got search results", "hits", hits)

	results := make([]IndexedResource, len(hits))
	for resKey, hit := range hits {
		ir := IndexedResource{}.FromSearchHit(hit)
		results[resKey] = ir
	}

	return results, nil
}

func tenant(res *Resource) string {
	return res.Metadata.Namespace
}

type SearchSummary struct {
	Kind     string `json:"kind"`
	Metadata `json:"metadata"`
	Spec     map[string]interface{} `json:"spec"`
}

type Metadata struct {
	Name              string
	Namespace         string
	Uid               string `json:"uid"`
	CreationTimestamp string `json:"creationTimestamp"`
	Labels            map[string]string
	Annotations       map[string]string
}

type Resource struct {
	Kind       string
	ApiVersion string
	Metadata   Metadata
}

type Opts struct {
	Workers    int // This controls how many goroutines are used to index objects
	BatchSize  int // This is the batch size for how many objects to add to the index at once
	Concurrent bool
}

func createFileIndex() (bleve.Index, string, error) {
	indexPath := fmt.Sprintf("%s%s.bleve", os.TempDir(), uuid.New().String())
	index, err := bleve.New(indexPath, createIndexMappings())
	if err != nil {
		golog.Fatalf("Failed to create index: %v", err)
	}
	return index, indexPath, err
}

func getResource(data []byte) (*Resource, error) {
	res := &Resource{}
	err := json.Unmarshal(data, res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (i *Index) getShard(tenant string) (Shard, error) {
	shard, ok := i.shards[tenant]
	if ok {
		return shard, nil
	}
	index, path, err := createFileIndex()
	if err != nil {
		return Shard{}, err
	}

	shard = Shard{
		index: index,
		path:  path,
		batch: index.NewBatch(),
	}
	// TODO: do we need to lock this?
	i.shards[tenant] = shard
	return shard, nil
}

// TODO - fetch from api
func fetchResourceTypes() []*ListOptions {
	items := []*ListOptions{}
	items = append(items, &ListOptions{
		Key: &ResourceKey{
			Group:    "playlist.grafana.app",
			Resource: "playlists",
		},
	}, &ListOptions{
		Key: &ResourceKey{
			Group:    "folder.grafana.app",
			Resource: "folders",
		},
	})
	return items
}
