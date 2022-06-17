package registry

import (
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)

var (
	// ErrModelAlreadyRegistered is returned when trying to register duplicate model to Generic.
	ErrModelAlreadyRegistered = errors.New("error registering duplicate model")
)

// Generic is a registry of coremodel instances. It is intended for use in cases where
// generic operations limited to coremodel.Interface are being performed.
type Generic struct {
	lock     sync.RWMutex
	models   []coremodel.Interface
	modelIdx map[string]coremodel.Interface
}

// NewRegistry returns a new Generic with the provided coremodel instances.
func NewRegistry(models ...coremodel.Interface) (*Generic, error) {
	r := &Generic{
		models:   make([]coremodel.Interface, 0, len(models)),
		modelIdx: make(map[string]coremodel.Interface, len(models)),
	}

	if err := r.addModels(models); err != nil {
		return nil, err
	}

	return r, nil
}

// Register adds coremodels to the Generic.
func (r *Generic) Register(models ...coremodel.Interface) error {
	return r.addModels(models)
}

// List returns all coremodels registered in this Generic.
func (r *Generic) List() []coremodel.Interface {
	r.lock.RLock()
	defer r.lock.RUnlock()

	return r.models
}

func (r *Generic) addModels(models []coremodel.Interface) error {
	r.lock.Lock()
	defer r.lock.Unlock()

	// Update model index and return an error if trying to register a duplicate.
	for _, m := range models {
		k := m.Lineage().Name()

		// Ensure assignability first. TODO will this blow up for dashboards?
		if err := thema.AssignableTo(m.CurrentSchema(), m.GoType()); err != nil {
			return fmt.Errorf("%s schema version %v not assignable to provided Go type: %w", k, m.CurrentSchema().Version(), err)
		}

		if _, ok := r.modelIdx[k]; ok {
			return ErrModelAlreadyRegistered
		}

		r.modelIdx[k] = m
	}

	// Remake model list.
	// TODO: this can be more performant (proper resizing, maybe single loop with index building, etc.).
	r.models = r.models[:0]
	for _, m := range r.modelIdx {
		r.models = append(r.models, m)
	}

	return nil
}
