package resource

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/atomic"

	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/infra/log"
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
	// TODO: we reuse kv.LastImportTimeKey and kv.ParseLastImportTimeKey from SQL/KV implementation.
	// The dependency tree is wrong (generic store depending on specific KV implementation), but it is what it is.
	// When sqlkv implementation is removed, we will move the methods back here.
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
	// TODO: move kv.ParseLastImportTimeKey to this package when sqlkv is removed.
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
	kv                         KV
	lastImportTimeMaxAge       time.Duration // If not zero, this store will regularly remove times from "last import times" older than this.
	lastImportTimeDeletionTime atomic.Time
	logger                     log.Logger
}

func newLastImportStore(kv KV, lastImportTimeMaxAge time.Duration, logger log.Logger) *lastImportStore {
	return &lastImportStore{
		kv:                   kv,
		lastImportTimeMaxAge: lastImportTimeMaxAge,
		logger:               logger,
	}
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

const (
	limitLastImportTimesDeletion = 10 * time.Minute
	// Limit the number of deleted keys to avoid ListLastImportTimes calls being too slow.
	maxDeletedImportTimes = 50
)

func (s *lastImportStore) ListLastImportTimes(ctx context.Context) ([]ResourceLastImportTime, error) {
	toReturn := map[NamespacedResource]LastImportTimeKey{}
	toDelete := []LastImportTimeKey(nil)

	now := time.Now()

	for k, err := range s.kv.Keys(ctx, lastImportTimesSection, ListOptions{
		Sort:  SortOrderAsc,
		Limit: 0, // Get all.
	}) {
		if err != nil {
			return nil, err
		}

		key, err := ParseLastImportKey(k)
		if err != nil {
			return nil, err
		}

		if s.lastImportTimeMaxAge > 0 && now.Sub(key.LastImportTime) > s.lastImportTimeMaxAge {
			toDelete = append(toDelete, key)
		} else {
			nsr := key.ToNamespacedResource()
			if key.LastImportTime.After(toReturn[nsr].LastImportTime) {
				toDelete = append(toDelete, toReturn[nsr]) // Save previous value for deletion.
				toReturn[nsr] = key
			}
		}
	}

	// Delete old or duplicate entries if enough time has passed since the last deletion.
	if time.Since(s.lastImportTimeDeletionTime.Load()) > limitLastImportTimesDeletion {
		deleted := 0
		for i := 0; i < len(toDelete) && i < maxDeletedImportTimes; i++ {
			err := s.kv.Delete(ctx, lastImportTimesSection, toDelete[i].String())
			if err != nil {
				s.logger.Warn("Failed to delete old last import times", "key", toDelete[i].String(), "err", err)
			} else {
				deleted++
			}
		}
		s.lastImportTimeDeletionTime.Store(now)
		if deleted > 0 {
			s.logger.Info("Deleted old last import times", "keys", deleted)
		}
	}

	// Convert toReturn to slice
	result := make([]ResourceLastImportTime, 0, len(toReturn))
	for _, key := range toReturn {
		result = append(result, key.ToResourceLastImportTime())
	}
	return result, nil
}
