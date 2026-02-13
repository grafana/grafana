package resource

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

const lastImportTimesSection = kv.LastImportTimeSection

type LastImportTimeKey struct {
	Namespace      string
	Group          string
	Resource       string
	LastImportTime time.Time
}

func (k LastImportTimeKey) String() string {
	return kv.LastImportTimeKey(k.Namespace, k.Group, k.Resource, k.LastImportTime)
}

func (k LastImportTimeKey) Validate() error {
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

func (k LastImportTimeKey) ToNamespacedResource() NamespacedResource {
	return NamespacedResource{
		Namespace: k.Namespace,
		Group:     k.Group,
		Resource:  k.Resource,
	}
}

func (k LastImportTimeKey) ToResourceLastImportTime() ResourceLastImportTime {
	return ResourceLastImportTime{
		NamespacedResource: k.ToNamespacedResource(),
		LastImportTime:     k.LastImportTime,
	}
}

func ParseLastImportKey(key string) (LastImportTimeKey, error) {
	ns, group, resource, t, err := kv.ParseLastImportTimeKey(key)
	if err != nil {
		return LastImportTimeKey{}, err
	}

	return LastImportTimeKey{
		Namespace:      ns,
		Group:          group,
		Resource:       resource,
		LastImportTime: t,
	}, nil
}

type lastImportStore struct {
	kv KV
}

func newLastImportStore(kv KV) *lastImportStore {
	return &lastImportStore{kv: kv}
}

func (s *lastImportStore) Save(ctx context.Context, time ResourceLastImportTime) error {
	k := LastImportTimeKey{
		Namespace:      time.Namespace,
		Group:          time.Group,
		Resource:       time.Resource,
		LastImportTime: time.LastImportTime,
	}

	if err := k.Validate(); err != nil {
		return fmt.Errorf("invalid event key: %w", err)
	}

	writer, err := s.kv.Save(ctx, lastImportTimesSection, k.String())
	if err != nil {
		return err
	}
	// There's no data.
	return writer.Close()
}

func (s *lastImportStore) ListLastImportTimes(ctx context.Context, lastImportTimeMaxAge time.Duration) (valid map[NamespacedResource]LastImportTimeKey, toDelete []LastImportTimeKey, _ error) {
	valid = map[NamespacedResource]LastImportTimeKey{}
	now := time.Now()

	for k, err := range s.kv.Keys(ctx, lastImportTimesSection, ListOptions{
		Sort:  SortOrderAsc,
		Limit: 0, // Get all.
	}) {
		if err != nil {
			return nil, nil, err
		}

		key, err := ParseLastImportKey(k)
		if err != nil {
			return nil, nil, err
		}

		if lastImportTimeMaxAge > 0 && now.Sub(key.LastImportTime) > lastImportTimeMaxAge {
			// Too old import time, don't return this value, but delete it.
			toDelete = append(toDelete, key)
			continue
		}

		nsr := key.ToNamespacedResource()
		prev, exists := valid[nsr]
		if !exists || key.LastImportTime.After(prev.LastImportTime) {
			if exists {
				// Save previous value for deletion.
				toDelete = append(toDelete, prev)
			}
			valid[nsr] = key
		}
	}

	return valid, toDelete, nil
}

func (s *lastImportStore) CleanupLastImportTimes(ctx context.Context, lastImportTimeMaxAge time.Duration) (int, error) {
	_, obsolete, err := s.ListLastImportTimes(ctx, lastImportTimeMaxAge)
	if err != nil {
		return 0, err
	}

	deleted := 0
	for i := 0; i < len(obsolete); i++ {
		err := s.kv.Delete(ctx, lastImportTimesSection, obsolete[i].String())
		if err != nil {
			return 0, fmt.Errorf("failed to delete old last import time %s: %w", obsolete[i].String(), err)
		} else {
			deleted++
		}
	}
	return deleted, nil
}
