package resource

import (
	"context"
	"fmt"
	"io"
	"iter"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
)

const (
	internalSection = "unified/internal"
)

type internalStore struct {
	kv KV
}

type InternalKey struct {
	Namespace  string
	Group      string
	Resource   string
	Subsection string
}

func (k InternalKey) String() string {
	return fmt.Sprintf("%s/%s/%s/%s/%s", strings.ToLower(k.Subsection), k.Group, k.Resource, k.Namespace)
}

func (k InternalKey) Validate() error {
	if k.Namespace == "" {
		return NewValidationError("namespace", k.Namespace, ErrNamespaceRequired)
	}
	if k.Subsection == "" {
		return NewValidationError("Subsection", k.Subsection, "Subsection is required")
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}
	return nil
}

func parseInternalKey(key string) (InternalKey, error) {
	parts := strings.Split(key, "/")
	if len(parts) != 5 {
		return InternalKey{}, fmt.Errorf("invalid internal key: %s", key)
	}
	return InternalKey{
		Subsection: parts[0],
		Group:      parts[1],
		Resource:   parts[2],
		Namespace:  parts[3],
	}, nil
}

func newInternalStore(kv KV) *internalStore {
	return &internalStore{
		kv: kv,
	}
}

type InternalData struct {
	Namespace  string
	Group      string
	Resource   string
	Subsection string
	Value      string
}

func (d *internalStore) Get(ctx context.Context, key InternalKey) (InternalData, error) {
	if err := key.Validate(); err != nil {
		return InternalData{}, fmt.Errorf("invalid internal key: %w", err)
	}

	reader, err := d.kv.Get(ctx, internalSection, key.String())
	defer func() { _ = reader.Close() }()
	if err != nil {
		return InternalData{}, err
	}

	value, err := io.ReadAll(reader)
	if err != nil {
		return InternalData{}, err
	}

	return InternalData{
		Namespace:  key.Namespace,
		Group:      key.Group,
		Resource:   key.Resource,
		Subsection: key.Subsection,
		Value:      string(value),
	}, nil
}

func (d *internalStore) BatchGet(ctx context.Context, keys []InternalKey) iter.Seq2[InternalData, error] {
	return func(yield func(InternalData, error) bool) {
		for _, key := range keys {
			if err := key.Validate(); err != nil {
				yield(InternalData{}, fmt.Errorf("invalid internal key %s: %w", key.String(), err))
				return
			}
		}

		// Process keys in batches. Uses same batch size as datastore.go
		for i := 0; i < len(keys); i += dataBatchSize {
			end := i + dataBatchSize
			if end > len(keys) {
				end = len(keys)
			}
			batch := keys[i:end]

			stringKeys := make([]string, len(batch))
			for j, key := range batch {
				stringKeys[j] = key.String()
			}

			for kv, err := range d.kv.BatchGet(ctx, internalSection, stringKeys) {
				if err != nil {
					yield(InternalData{}, err)
					return
				}

				key, err := parseInternalKey(kv.Key)
				if err != nil {
					yield(InternalData{}, err)
					return
				}

				value, err := io.ReadAll(kv.Value)
				if err != nil {
					yield(InternalData{}, err)
					return
				}

				if !yield(InternalData{
					Namespace:  key.Namespace,
					Group:      key.Group,
					Resource:   key.Resource,
					Subsection: key.Subsection,
					Value:      string(value),
				}, nil) {
					return
				}
			}
		}
	}
}

func (d *internalStore) GetSubsection(ctx context.Context, Subsection string) iter.Seq2[InternalKey, error] {
	opts := ListOptions{
		Sort:     SortOrderAsc,
		StartKey: Subsection,
	}
	return func(yield func(InternalKey, error) bool) {
		for key, err := range d.kv.Keys(ctx, internalSection, opts) {
			if err != nil {
				yield(InternalKey{}, err)
				return
			}

			internalKey, err := parseInternalKey(key)
			if err != nil {
				yield(InternalKey{}, err)
				return
			}

			if !yield(internalKey, nil) {
				return
			}
		}
	}
}

func (d *internalStore) Save(ctx context.Context, key InternalKey, value string) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid internal key: %w", err)
	}

	writer, err := d.kv.Save(ctx, internalSection, key.String())
	if err != nil {
		return err
	}

	_, err = io.WriteString(writer, value)
	if err != nil {
		_ = writer.Close()
		return err
	}

	return writer.Close()
}

func (d *internalStore) Delete(ctx context.Context, key InternalKey) error {
	if err := key.Validate(); err != nil {
		return fmt.Errorf("invalid internal key: %w", err)
	}

	return d.kv.Delete(ctx, internalSection, key.String())
}
