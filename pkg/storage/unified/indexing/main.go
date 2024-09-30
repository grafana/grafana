package main

import (
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
)

// *** This is the current schema of the resource table ***
//| Field            | Type         | Null | Key | Default | Extra |
//+------------------+--------------+------+-----+---------+-------+
//| guid             | varchar(36)  | NO   | PRI | NULL    |       |
//| resource_version | bigint       | YES  |     | NULL    |       |
//| group            | varchar(190) | NO   |     | NULL    |       |
//| resource         | varchar(190) | NO   |     | NULL    |       |
//| namespace        | varchar(63)  | NO   | MUL | NULL    |       |
//| name             | varchar(190) | NO   |     | NULL    |       |
//| value            | longtext     | YES  |     | NULL    |       |
//| action           | int          | NO   |     | NULL    |       |
//| label_set        | varchar(64)  | YES  |     | NULL    |       |
//+------------------+--------------+------+-----+---------+-------+

// Object represents the data structure we'll index
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

// ***** Constants for indexing ********
// This controls how many goroutines are used to index objects
const INDEX_WORKERS = 10

// This is the batch size for how many objects to add to the index at once
const INDEX_BATCH_SIZE = 1000

//**************************************

func main() {
	fmt.Println("Seeding...")
	objects := seedObjects()

	fmt.Println("Creating index for", len(objects), "objects")

	// Create in memory index
	index, exists := createInMemoryIndex()

	// Create file based index
	//index, exists, err := createFileIndex(true)
	//if err != nil {
	//	log.Fatalf("Failed to create index: %v", err)
	//}

	defer index.Close()

	// only reindex if the index is new (or in memory)
	if !exists {
		fmt.Println("Indexing...")
		start := time.Now()

		IndexObjects(index, objects)
		//indexObjectsConcurrently(index, objects)

		end := time.Since(start).Seconds()
		fmt.Printf("Indexing completed in %f seconds\n", end)
	}

	fields, _ := index.Fields()
	fmt.Println("Indexed fields are:", fields)

	fmt.Println("Searching...")
	// MatchAllQuery
	query := bleve.NewMatchAllQuery()

	// MatchQuery
	//query := bleve.NewMatchQuery("playlists-1")
	//query.SetField("Value.K8sMeta.Name")

	// PhraseQuery
	//query := bleve.NewPhraseQuery([]string{"playlists", "0"}, "Value.K8sMeta.Name")

	// MatchPhraseQuery
	//query := bleve.NewMatchPhraseQuery("playlist-1")
	//query.SetField("Value.K8sMeta.Name")

	// FuzzyQuery
	//query := bleve.NewFuzzyQuery("playlists1")
	//query.SetField("Value.K8sMeta.Name")

	// Create a search request
	searchRequest := bleve.NewSearchRequest(query)
	searchRequest.Size = 30 // Number of results to return
	searchRequest.IncludeLocations = true

	// Execute the search
	searchResult, err := index.Search(searchRequest)
	if err != nil {
		log.Fatalf("Search failed: %v", err)
	}

	// Display search results
	fmt.Printf("Total Hits: %d\n", searchResult.Total)
	for _, hit := range searchResult.Hits {
		fmt.Printf("Object ID: %s, Score: %f\n", hit.ID, hit.Score)

		// Retrieve the document to display more details
		//var doc Object
		//err := index.Object(hit.ID).VisitFields(func(field bleve.DocumentField) {
		//	switch field.Name() {
		//	case "Title":
		//		doc.Title = string(field.Value())
		//	case "Content":
		//		doc.Content = string(field.Value())
		//	case "Tags":
		//		doc.Tags = append(doc.Tags, string(field.Value()))
		//	}
		//})
		//if err != nil {
		//	log.Printf("Failed to retrieve document %s: %v", hit.ID, err)
		//	continue
		//}
		//
		//fmt.Printf("Title: %s\n", doc.Title)
		//fmt.Printf("Content: %s\n", doc.Content)
		//fmt.Printf("Tags: %v\n", doc.Tags)
		//fmt.Println("---------")
	}
}

func seedObjects() []Object {
	type Resource struct {
		Group      string
		Resource   string
		Kind       string
		ApiVersion string
	}

	namespaces := []string{"stack-1", "stack-2"}
	resources := []Resource{
		{
			Group:      "playlist.grafana.app",
			Resource:   "playlists",
			Kind:       "Playlist",
			ApiVersion: "playlist.grafana.app/v0alpha1",
		},
		{
			Group:      "folder.grafana.app",
			Resource:   "folders",
			Kind:       "Folder",
			ApiVersion: "folder.grafana.app/v0alpha1",
		},
	}

	// creates 4,000,000 objects
	objects := []Object{}
	for _, namespace := range namespaces {
		for _, resource := range resources {
			for i := 0; i < 10000; i++ {
				objects = append(objects, Object{
					Guid:            fmt.Sprintf("%s-%s-%d", namespace, resource.Resource, i),
					ResourceVersion: time.Now().UnixNano(),
					Group:           resource.Group,
					Resource:        resource.Resource,
					Namespace:       namespace,
					Name:            fmt.Sprintf("%s-%s-%d", namespace, resource.Resource, i),
					Value: K8sObject{
						Kind:       resource.Kind,
						ApiVersion: resource.ApiVersion,
						K8sMeta: K8sMeta{
							Name:              fmt.Sprintf("%s-%s-%d", namespace, resource.Resource, i),
							Namespace:         namespace,
							Uid:               fmt.Sprintf("k8s-uid-%d", i),
							CreationTimestamp: time.Now().Add(-time.Duration(i) * time.Hour).Format(time.RFC3339),
						},
					},
				})
			}
		}
	}

	return objects
}

func IndexObjects(index bleve.Index, objects []Object) {
	for _, obj := range objects {
		err := index.Index(obj.Guid, obj)
		if err != nil {
			fmt.Println("Failed to index document:", err)
		}
	}

	fmt.Println("Indexing synchronously completed")
}

func indexObjectsConcurrently(index bleve.Index, objects []Object) {
	// Create a wait group to wait for all goroutines to finish
	var wg sync.WaitGroup

	// Create a channel to send batches to the workers
	batchChan := make(chan *bleve.Batch)

	// Start workers (goroutines)
	for i := 0; i < INDEX_WORKERS; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for batch := range batchChan {
				err := index.Batch(batch)
				if err != nil {
					log.Fatal(err)
				}
			}
		}()
	}

	// Create and send batches
	for i := 0; i < len(objects); i += INDEX_BATCH_SIZE {
		end := i + INDEX_BATCH_SIZE
		if end > len(objects) {
			end = len(objects)
		}

		// Add documents to a new batch of size INDEX_BATCH_SIZE
		batch := index.NewBatch()
		for _, obj := range objects[i:end] {
			docID := obj.Guid
			err := batch.Index(docID, obj)
			if err != nil {
				fmt.Println("Failed to add document to batch:", err)
			}
		}

		// Send the batch to the workers
		batchChan <- batch
	}

	// Close the channel and wait for all workers to finish
	close(batchChan)
	wg.Wait()

	log.Println("Concurrent batch indexing completed successfully")
}

// this will only create an in-memory index right now
func createFileIndex(deleteExisting bool) (bleve.Index, bool, error) {
	// Define the index path
	indexPath := "example.bleve"
	exists := true

	// delete the index files if they exist
	if deleteExisting {
		err := os.RemoveAll(indexPath)
		if err != nil {
			fmt.Println("Error:", err)
		} else {
			fmt.Println("Index files deleted successfully!")
			exists = false
		}
	}

	// Attempt to open an existing index
	index, err := bleve.Open(indexPath)

	if err == bleve.ErrorIndexPathDoesNotExist {
		exists = false

		index, err = bleve.New(indexPath, createIndexMappings())
		if err != nil {
			log.Fatalf("Failed to create index: %v", err)
		}

	} else if err != nil {
		log.Fatalf("Failed to open index: %v", err)
	}

	return index, exists, err
}

func createInMemoryIndex() (bleve.Index, bool) {
	index, err := bleve.NewMemOnly(createIndexMappings())
	if err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

	return index, false
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
