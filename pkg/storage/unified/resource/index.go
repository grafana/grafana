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
	// TODO: configure resources to index in ini file?
	r := &ListRequest{Options: &ListOptions{
		Key: &ResourceKey{
			Group:    "playlist.grafana.app",
			Resource: "playlists",
		},
	}}

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

type Object struct {
	Guid            string
	ResourceVersion int64
	Group           string
	Resource        string
	Namespace       string
	Name            string
	Value           K8sObject
	Action          int
}

type K8sMeta struct {
	Name              string
	Namespace         string
	Uid               string
	CreationTimestamp string
}

type K8sObject struct {
	Kind       string
	ApiVersion string
	K8sMeta    K8sMeta
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

func createIndexMappings() *mapping.IndexMappingImpl {
	// Define field mappings for specific fields
	nameFieldMapping := bleve.NewTextFieldMapping()
	creationTimestampFieldMapping := bleve.NewDateTimeFieldMapping()
	resourceFieldMapping := bleve.NewTextFieldMapping()

	//Create a K8sMeta mapping with specific fields
	k8sMetaMapping := bleve.NewDocumentMapping()
	k8sMetaMapping.AddFieldMappingsAt("Name", nameFieldMapping)
	k8sMetaMapping.AddFieldMappingsAt("CreationTimestamp", creationTimestampFieldMapping)
	k8sMetaMapping.Dynamic = false

	//Create a K8sObject mapping and attach the K8sMeta mapping
	k8sObjectMapping := bleve.NewDocumentMapping()
	k8sObjectMapping.AddSubDocumentMapping("K8sMeta", k8sMetaMapping)
	k8sObjectMapping.Dynamic = false

	//Create the root document mapping and attach the K8sObject mapping
	objectMapping := bleve.NewDocumentMapping()
	objectMapping.AddSubDocumentMapping("Value", k8sObjectMapping)
	objectMapping.AddFieldMappingsAt("Resource", resourceFieldMapping)
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
