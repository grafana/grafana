package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/google/uuid"
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
}

func NewIndex(s *server, opts Opts) *Index {
	idx := &Index{
		s:      s,
		opts:   opts,
		shards: make(map[string]Shard),
	}
	return idx
}

func (i *Index) Init(ctx context.Context) error {
	resourceTypes := fetchResourceTypes()
	for _, rt := range resourceTypes {
		r := &ListRequest{Options: rt}
		list, err := i.s.List(ctx, r)
		if err != nil {
			return err
		}

		for _, obj := range list.Items {
			res, err := getResource(obj.Value)
			if err != nil {
				return err
			}

			shard, err := i.getShard(tenant(res))
			if err != nil {
				return err
			}
			err = shard.batch.Index(res.Metadata.Uid, obj)
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
	}

	return nil
}

func (i *Index) Index(ctx context.Context, data *Data) error {
	res, err := getResource(data.Value.Value)
	if err != nil {
		return err
	}
	tenant := tenant(res)
	shard, err := i.getShard(tenant)
	if err != nil {
		return err
	}
	err = shard.index.Index(res.Metadata.Uid, data.Value.Value)
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

func tenant(res *Resource) string {
	return res.Metadata.Namespace
}

type Metadata struct {
	Name              string
	Namespace         string
	Uid               string
	CreationTimestamp string
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
		log.Fatalf("Failed to create index: %v", err)
	}
	return index, indexPath, err
}

// TODO: clean this up.  it was copied from owens performance test
func createIndexMappings() *mapping.IndexMappingImpl {
	//Create mapping for the name and creationTimestamp fields in the metadata
	nameFieldMapping := bleve.NewTextFieldMapping()
	creationTimestampFieldMapping := bleve.NewDateTimeFieldMapping()
	metaMapping := bleve.NewDocumentMapping()
	metaMapping.AddFieldMappingsAt("name", nameFieldMapping)
	metaMapping.AddFieldMappingsAt("creationTimestamp", creationTimestampFieldMapping)
	metaMapping.Dynamic = false

	//Create a sub-document mapping for the metadata field
	objectMapping := bleve.NewDocumentMapping()
	objectMapping.AddSubDocumentMapping("metadata", metaMapping)

	// Map top level fields - just kind for now
	kindFieldMapping := bleve.NewTextFieldMapping()
	objectMapping.AddFieldMappingsAt("kind", kindFieldMapping)
	objectMapping.Dynamic = false

	// Create the index mapping
	indexMapping := bleve.NewIndexMapping()
	indexMapping.DefaultMapping = objectMapping
	indexMapping.DefaultMapping.Dynamic = false

	return indexMapping
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
	})
	return items
}
