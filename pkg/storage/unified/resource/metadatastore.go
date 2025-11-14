package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
)

const (
	metadatasSection = "unified/metadata"
)

type metadataStore struct {
	kv KV
}

type MetadataKey struct {
	Namespace string
	Group     string
	Resource  string
}

func (k MetadataKey) String() string {
	return fmt.Sprintf("%s/%s/%s", k.Group, k.Resource, k.Namespace)
}

func (k MetadataKey) Validate() error {
	if k.Namespace == "" {
		return NewValidationError("namespace", k.Namespace, ErrNamespaceRequired)
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}
	return nil
}

type Metadata struct {
	Namespace      string    `json:"namespace"`
	Group          string    `json:"group"`
	Resource       string    `json:"resource"`
	LastImportTime time.Time `json:"lastImportTime"`
}

func newMetadataStore(kv KV) *metadataStore {
	return &metadataStore{
		kv: kv,
	}
}

func (d *metadataStore) Get(ctx context.Context, key MetadataKey) (Metadata, error) {
	if err := key.Validate(); err != nil {
		return Metadata{}, fmt.Errorf("invalid metadata key: %w", err)
	}

	reader, err := d.kv.Get(ctx, metadatasSection, key.String())
	if err != nil {
		return Metadata{}, err
	}
	defer func() { _ = reader.Close() }()
	var metadata Metadata
	if err = json.NewDecoder(reader).Decode(&metadata); err != nil {
		return Metadata{}, err
	}
	return metadata, nil
}

func (d *metadataStore) Save(ctx context.Context, metadata Metadata) error {
	metadataKey := MetadataKey{
		Namespace: metadata.Namespace,
		Group:     metadata.Group,
		Resource:  metadata.Resource,
	}

	if err := metadataKey.Validate(); err != nil {
		return fmt.Errorf("invalid metadataKey key: %w", err)
	}

	writer, err := d.kv.Save(ctx, metadatasSection, metadataKey.String())
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(writer)
	if err := encoder.Encode(metadata); err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}
