package resource

import (
	"context"
	"encoding/json"
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
	// TODO: maybe but we know this is slower
	// if opts.InMemory {
	// 	index := createInMemoryIndex()
	// 	return index, nil
	// }

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
		// example resource
		//{"kind":"Playlist","apiVersion":"playlist.grafana.app/v0alpha1","metadata":{"name":"xkhv8h","namespace":"default","uid":"9972273d-7fb2-4977-91b7-15501d52cb95","creationTimestamp":"2024-09-24T15:54:09Z","labels":{"foo":"bar"},"annotations":{"grafana.app/createdBy":"user:edxplq00uoi68d","grafana.app/slug":"slugger"},"managedFields":[{"manager":"kubectl-create","operation":"Update","apiVersion":"playlist.grafana.app/v0alpha1","time":"2024-09-24T15:54:09Z","fieldsType":"FieldsV1","fieldsV1":{"f:metadata":{"f:annotations":{".":{},"f:grafana.app/slug":{},"f:grafana.app/updatedBy":{}},"f:generateName":{},"f:labels":{".":{},"f:foo":{}}},"f:spec":{"f:interval":{},"f:items":{},"f:title":{}}}}]},"spec":{"interval":"5m","items":[{"type":"dashboard_by_tag","value":"panel-tests"},{"type":"dashboard_by_uid","value":"vmie2cmWz"}],"title":"Playlist with auto generated UID"},"status":{}}
		res := &Resource{}
		err := json.Unmarshal(obj.Value, res)
		if err != nil {
			return err
		}
		// TODO: how to get tenant?
		tenant := tenant(res)
		shard, ok := i.shards[tenant]
		if !ok {
			index, path, err := createFileIndex()
			if err != nil {
				return err
			}

			shard = Shard{
				index: index,
				path:  path,
				batch: index.NewBatch(),
			}
			i.shards[tenant] = shard
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

// TODO: how to get tenant?
func tenant(res *Resource) string {
	tenant, ok := res.Metadata.Annotations["grafana.app/slug"]
	if !ok {
		tenant = "default"
	}
	return tenant
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
	InMemory   bool
	Concurrent bool
}

func createFileIndex() (bleve.Index, string, error) {
	indexPath := os.TempDir() + uuid.New().String() + ".bleve"
	index, err := bleve.New(indexPath, createIndexMappings())
	if err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}
	return index, indexPath, err
}

// TODO: maybe but we know this is slower
// func createInMemoryIndex() *bleve.Index {
// 	index, err := bleve.NewMemOnly(createIndexMappings())
// 	if err != nil {
// 		log.Fatalf("Failed to create index: %v", err)
// 	}

// 	return &index
// }

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
