package components

import (
	"fmt"
	"sync"

	"github.com/grafana/thema"
)

// Registry is a registry of Coremodels.
type Registry struct {
	lock     sync.RWMutex
	models   []Coremodel
	modelIdx map[string]Coremodel
}

// NewCoremodelRegistry returns a new KubeControllerRegistry with the provided KubeControllers.
func NewCoremodelRegistry(models ...Coremodel) (*Registry, error) {
	r := &Registry{
		models:   make([]Coremodel, 0, len(models)),
		modelIdx: make(map[string]Coremodel, len(models)),
	}

	if err := r.addModels(models); err != nil {
		return nil, err
	}

	return r, nil
}

// Register adds models to the Registry.
func (r *Registry) Register(models ...Coremodel) error {
	return r.addModels(models)
}

// List returns all coremodels registered in this Registry.
func (r *Registry) List() []Coremodel {
	r.lock.RLock()
	defer r.lock.RUnlock()

	return r.models
}

func (r *Registry) addModels(models []Coremodel) error {
	r.lock.Lock()
	defer r.lock.Unlock()

	// Update model index and return an error if trying to register a duplicate.
	for _, m := range models {
		k := m.Lineage().Name()

		// Ensure assignability first. TODO will this blow up for dashboards?
		if err := thema.AssignableTo(m.Schema(), m.GoType()); err != nil {
			return fmt.Errorf("%s schema version %v not assignable to provided Go type: %w", k, m.Schema().Version(), err)
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
