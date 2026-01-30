package resource

import (
	"context"
	"fmt"
	"iter"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
)

const lastImportTimesSection = "unified/last_import"

type lastImportStore struct {
	kv KV
}

type LastImportKey struct {
	Namespace      string
	Group          string
	Resource       string
	LastImportTime uint64
}

func (k LastImportKey) String() string {
	return fmt.Sprintf("%s~%s~%s~%d", k.Namespace, k.Group, k.Resource, k.LastImportTime)
}

func (k LastImportKey) Validate() error {
	if k.Namespace == "" {
		return NewValidationError("namespace", k.Namespace, ErrNamespaceRequired)
	}
	if err := validation.IsValidNamespace(k.Namespace); err != nil {
		return NewValidationError("namespace", k.Namespace, err[0])
	}
	if err := validation.IsValidGroup(k.Group); err != nil {
		return NewValidationError("group", k.Group, err[0])
	}
	if err := validation.IsValidResource(k.Resource); err != nil {
		return NewValidationError("resource", k.Resource, err[0])
	}

	return nil
}

func (k LastImportKey) ToResourceLastImportTime() ResourceLastImportTime {
	return ResourceLastImportTime{
		NamespacedResource: NamespacedResource{
			Namespace: k.Namespace,
			Group:     k.Group,
			Resource:  k.Resource,
		},
		LastImportTime: time.UnixMilli(int64(k.LastImportTime)),
	}
}

func ParseLastImportKey(key string) (LastImportKey, error) {
	parts := strings.Split(key, "~")
	if len(parts) != 4 {
		return LastImportKey{}, fmt.Errorf("invalid key format: expected 4 parts, got %d", len(parts))
	}

	t, err := strconv.ParseUint(parts[3], 10, 64)
	if err != nil {
		return LastImportKey{}, fmt.Errorf("invalid timestamp: %w", err)
	}

	return LastImportKey{
		Namespace:      parts[0],
		Group:          parts[1],
		Resource:       parts[2],
		LastImportTime: t,
	}, nil

}

func newLastImportStore(kv KV) *lastImportStore {
	return &lastImportStore{
		kv: kv,
	}
}

func (n *lastImportStore) Save(ctx context.Context, time ResourceLastImportTime) error {
	k := LastImportKey{
		Namespace:      time.Namespace,
		Group:          time.Group,
		Resource:       time.Resource,
		LastImportTime: uint64(time.LastImportTime.UnixMilli()),
	}

	if err := k.Validate(); err != nil {
		return fmt.Errorf("invalid event key: %w", err)
	}

	writer, err := n.kv.Save(ctx, lastImportTimesSection, k.String())
	if err != nil {
		return err
	}
	// There's no data.
	return writer.Close()
}

func (n *lastImportStore) ListLastImportTimes(ctx context.Context) iter.Seq2[LastImportKey, error] {
	return func(yield func(LastImportKey, error) bool) {
		for k, err := range n.kv.Keys(ctx, lastImportTimesSection, ListOptions{
			Sort:  SortOrderAsc,
			Limit: 0, // Get all.
		}) {
			if err != nil {
				yield(LastImportKey{}, err)
				return
			}

			key, err := ParseLastImportKey(k)
			if err != nil {
				yield(LastImportKey{}, err)
				return
			}
			if !yield(key, nil) {
				return
			}
		}
	}
}
