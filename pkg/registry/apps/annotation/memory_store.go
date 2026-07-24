package annotation

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
)

type memoryStore struct {
	mu   sync.RWMutex
	data map[string]*annotationV0.Annotation
}

func NewMemoryStore() Store {
	return &memoryStore{
		data: make(map[string]*annotationV0.Annotation),
	}
}

func (m *memoryStore) Close() error { return nil }

func (m *memoryStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := namespace + "/" + name
	anno, ok := m.data[key]
	if !ok {
		return nil, ErrNotFound
	}

	return anno.DeepCopy(), nil
}

func (m *memoryStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	filter := opts.Deleted
	if filter != DeletedExclude && filter != DeletedInclude && filter != DeletedOnly {
		filter = DeletedExclude
	}

	//nolint:prealloc
	var result []annotationV0.Annotation // no, we can't pre-alloc it, we don't know the size yet

	for _, anno := range m.data {
		if matchesList(anno, namespace, filter, opts) {
			result = append(result, *anno.DeepCopy())
		}
	}

	sortByEndTime(result)

	if opts.Limit > 0 && int64(len(result)) > opts.Limit {
		result = result[:opts.Limit]
	}

	return &AnnotationList{Items: result}, nil
}

func matchesList(anno *annotationV0.Annotation, namespace string, filter DeletedFilter, opts ListOptions) bool {
	if anno.Namespace != namespace {
		return false
	}
	deleted := anno.DeletionTimestamp != nil
	if deleted && filter == DeletedExclude {
		return false
	}
	if !deleted && filter == DeletedOnly {
		return false
	}
	if opts.DashboardUID != "" && (anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID != opts.DashboardUID) {
		return false
	}
	if opts.PanelID != 0 && (anno.Spec.PanelID == nil || *anno.Spec.PanelID != opts.PanelID) {
		return false
	}
	if opts.From > 0 && anno.Spec.Time < opts.From {
		return false
	}
	if opts.To > 0 && anno.Spec.Time > opts.To {
		return false
	}
	if len(opts.Tags) > 0 && !matchTags(anno.Spec.Tags, opts.Tags, opts.TagsMatchAny) {
		return false
	}
	if len(opts.Scopes) > 0 && !matchScopes(anno.Spec.Scopes, opts.Scopes, opts.ScopesMatchAny) {
		return false
	}
	if opts.CreatedBy != "" && anno.GetCreatedBy() != opts.CreatedBy {
		return false
	}
	if opts.LegacyID > 0 && GetLegacyID(anno) != opts.LegacyID {
		return false
	}
	return true
}

func sortByEndTime(items []annotationV0.Annotation) {
	endTime := func(a annotationV0.Annotation) int64 {
		if a.Spec.TimeEnd != nil {
			return *a.Spec.TimeEnd
		}
		return a.Spec.Time
	}
	slices.SortFunc(items, func(a, b annotationV0.Annotation) int {
		if n := cmp.Compare(endTime(b), endTime(a)); n != 0 {
			return n
		}
		if n := cmp.Compare(b.Spec.Time, a.Spec.Time); n != 0 {
			return n
		}
		return cmp.Compare(a.Name, b.Name)
	})
}

func matchTags(annoTags []string, filterTags []string, matchAny bool) bool {
	if matchAny {
		for _, filterTag := range filterTags {
			for _, annoTag := range annoTags {
				if annoTag == filterTag {
					return true
				}
			}
		}
		return false
	}

	for _, filterTag := range filterTags {
		found := false
		for _, annoTag := range annoTags {
			if annoTag == filterTag {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func matchScopes(annoScopes []string, filterScopes []string, matchAny bool) bool {
	if matchAny {
		for _, filterScope := range filterScopes {
			for _, annoScope := range annoScopes {
				if annoScope == filterScope {
					return true
				}
			}
		}
		return false
	}

	for _, filterScope := range filterScopes {
		found := false
		for _, annoScope := range annoScopes {
			if annoScope == filterScope {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func (m *memoryStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := anno.Namespace + "/" + anno.Name

	if _, exists := m.data[key]; exists {
		return nil, fmt.Errorf("%w: %s", ErrAlreadyExists, key)
	}

	created := anno.DeepCopy()
	if created.UID == "" {
		created.UID = types.UID(created.Name)
	}
	if created.CreationTimestamp.IsZero() {
		created.CreationTimestamp = metav1.Now()
	}

	m.data[key] = created

	return created, nil
}

func (m *memoryStore) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := anno.Namespace + "/" + anno.Name

	existing, exists := m.data[key]
	if !exists {
		return nil, ErrNotFound
	}

	if existing.DeletionTimestamp != nil {
		return nil, ErrNotFound
	}

	updated := anno.DeepCopy()
	m.data[key] = updated

	return updated, nil
}

func (m *memoryStore) Delete(ctx context.Context, namespace, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := namespace + "/" + name

	anno, exists := m.data[key]
	if !exists || anno.DeletionTimestamp != nil {
		return ErrNotFound
	}

	now := metav1.Now()
	anno.DeletionTimestamp = &now
	return nil
}

func (m *memoryStore) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tagCounts := make(map[string]int64)

	for _, anno := range m.data {
		if anno.Namespace != namespace {
			continue
		}
		if anno.DeletionTimestamp != nil {
			continue
		}
		for _, tag := range anno.Spec.Tags {
			if opts.Prefix == "" || strings.HasPrefix(tag, opts.Prefix) {
				tagCounts[tag]++
			}
		}
	}

	tags := make([]Tag, 0, len(tagCounts))
	for name, count := range tagCounts {
		tags = append(tags, Tag{Name: name, Count: count})
	}

	if opts.Limit > 0 && len(tags) > opts.Limit {
		tags = tags[:opts.Limit]
	}

	return tags, nil
}
