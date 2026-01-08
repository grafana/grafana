package annotation

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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

func (m *memoryStore) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	key := namespace + "/" + name
	anno, ok := m.data[key]
	if !ok {
		return nil, fmt.Errorf("annotation not found")
	}

	return anno.DeepCopy(), nil
}

func (m *memoryStore) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	//nolint:prealloc
	var result []annotationV0.Annotation // no, we can't pre-alloc it, we don't know the size yet

	for _, anno := range m.data {
		if anno.Namespace != namespace {
			continue
		}

		if opts.DashboardUID != "" && (anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID != opts.DashboardUID) {
			continue
		}

		if opts.PanelID != 0 && (anno.Spec.PanelID == nil || *anno.Spec.PanelID != opts.PanelID) {
			continue
		}

		if opts.From > 0 && anno.Spec.Time < opts.From {
			continue
		}

		if opts.To > 0 && anno.Spec.Time > opts.To {
			continue
		}

		result = append(result, *anno.DeepCopy())

		if opts.Limit > 0 && int64(len(result)) >= opts.Limit {
			break
		}
	}

	return &AnnotationList{Items: result}, nil
}

func (m *memoryStore) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if anno.Name == "" {
		anno.Name = uuid.New().String()
	}

	key := anno.Namespace + "/" + anno.Name

	if _, exists := m.data[key]; exists {
		return nil, fmt.Errorf("annotation already exists")
	}

	created := anno.DeepCopy()
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

	if _, exists := m.data[key]; !exists {
		return nil, fmt.Errorf("annotation not found")
	}

	updated := anno.DeepCopy()
	m.data[key] = updated

	return updated, nil
}

func (m *memoryStore) Delete(ctx context.Context, namespace, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := namespace + "/" + name

	if _, exists := m.data[key]; !exists {
		return fmt.Errorf("annotation not found")
	}

	delete(m.data, key)
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
