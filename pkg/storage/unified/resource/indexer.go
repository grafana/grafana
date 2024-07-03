package resource

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sort"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	parquet "github.com/parquet-go/parquet-go"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// RowType is a struct that represents a row in a parquet file.
type RowType struct {
	Namespace, Group, Resource, Name string
	// LabelKey, LabelValue             string
}

type indexer struct {
	store StorageBackend
	blob  BlobStore
	log   *slog.Logger
}

func NewIndexer(store StorageBackend, blob BlobStore) *indexer {
	return &indexer{
		store: store,
		blob:  blob,
		log:   slog.Default().With("").With("logger", "indexer"),
	}
}

func (i *indexer) Run(ctx context.Context) error {
	c, err := i.store.WatchWriteEvents(ctx)
	if err != nil {
		return err
	}
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case event := <-c:
			if event.Key.Resource == "parquetfile" {
				continue // skip to avoid loop
			}
			err = i.processEvent(ctx, event)
			if err != nil {
				i.log.Error("error processing event", "error", err)
				return err
			}
		}
	}
}

func (i *indexer) processEvent(ctx context.Context, event *WrittenEvent) error {
	// generate a new parquet index
	buf, rv, err := i.createParquetIndex(ctx, event.Key)
	if err != nil {
		return err
	}

	k := &ResourceKey{
		Namespace: event.Key.Namespace,
		Group:     "grafana.app",
		Resource:  "parquetfile",
		Name:      "latest",
	}
	// upload to blob store
	br, err := i.blob.PutBlob(ctx, &PutBlobRequest{
		Resource:    k,
		Value:       buf.Bytes(),
		ContentType: "application/vnd.apache.parquet",
	})
	if err != nil {
		return err
	}

	// write the index to the store
	// TODO: this should be a real grafana resource
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "v1alpha1",
			"kind":       "parquetfile",
			"metadata": map[string]interface{}{
				"name":      k.Name,
				"namespace": k.Namespace,
				"labels": map[string]string{
					utils.AnnoKeyBlob: br.Uid,
				},
			},
			"status": map[string]interface{}{
				"lastGeneratedRV": rv,
			},
		},
	}

	data, err := json.Marshal(obj)
	if err != nil {
		return err
	}

	// TODO
	if _, err := i.store.Read(ctx, &ReadRequest{Key: k}); err != nil {
		_, err = i.store.WriteEvent(ctx, WriteEvent{
			Type:  WatchEvent_ADDED,
			Key:   k,
			Value: data,
		})
		return err
	}
	_, err = i.store.WriteEvent(ctx, WriteEvent{
		Type:  WatchEvent_MODIFIED,
		Key:   k,
		Value: data,
	})
	return err
}

// For now we ignore the key and generate a single global index
func (i *indexer) createParquetIndex(ctx context.Context, k *ResourceKey) (*bytes.Buffer, int64, error) {

	buffer := parquet.NewGenericBuffer[RowType](
		parquet.SortingRowGroupConfig(
			parquet.SortingColumns(
				parquet.Ascending("Namespace"),
				parquet.Ascending("Group"),
				parquet.Ascending("Resource"),
				parquet.Ascending("Name"),
			),
		),
	)

	resp, err := i.store.PrepareList(ctx, &ListRequest{ // TODO: set RV as well ?

		Options: &ListOptions{
			Key: &ResourceKey{
				Namespace: k.Namespace,
			},
		},
	})
	if err != nil {
		return nil, 0, err
	}
	for _, item := range resp.Items {
		rows, err := i.getRows(item.Value)
		if err != nil {
			return nil, 0, err
		}
		fmt.Println(rows)
		buffer.Write(rows)
	}
	sort.Sort(buffer)

	b := new(bytes.Buffer)
	writer := parquet.NewGenericWriter[RowType](b)

	_, err = parquet.CopyRows(writer, buffer.Rows())
	if err != nil {
		return nil, 0, err
	}
	if err = writer.Close(); err != nil {
		return nil, 0, err
	}
	return b, resp.ResourceVersion, nil
}

// TODO: This function is highly cachable.
func (i *indexer) getRows(value []byte) ([]RowType, error) {
	partial := &metav1.PartialObjectMetadata{}
	err := json.Unmarshal(value, partial)
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(partial)
	if err != nil {
		return nil, err
	}

	return []RowType{
		{
			Namespace: obj.GetNamespace(),
			Name:      obj.GetName(),
			// TODO : Add GRV.
			// LabelKey:   k,
			// LabelValue: v,
		},
	}, nil
}
