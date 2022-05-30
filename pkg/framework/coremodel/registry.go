package coremodel

import (
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/thema"
)

var (
	// ErrModelAlreadyRegistered is returned when trying to register duplicate model to Registry.
	ErrModelAlreadyRegistered = errors.New("error registering duplicate model")
)

// Registry is a registry of coremodel instances.
type Registry struct {
	lock     sync.RWMutex
	models   []Interface
	modelIdx map[string]Interface
}

// NewRegistry returns a new Registry with the provided coremodel instances.
func NewRegistry(models ...Interface) (*Registry, error) {
	r := &Registry{
		models:   make([]Interface, 0, len(models)),
		modelIdx: make(map[string]Interface, len(models)),
	}

	if err := r.addModels(models); err != nil {
		return nil, err
	}

	return r, nil
}

// Register adds coremodels to the Registry.
func (r *Registry) Register(models ...Interface) error {
	return r.addModels(models)
}

// List returns all coremodels registered in this Registry.
func (r *Registry) List() []Interface {
	r.lock.RLock()
	defer r.lock.RUnlock()

	return r.models
}

func (r *Registry) addModels(models []Interface) error {
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

// Get retrieves a coremodel with the given string identifier. nil, false
// is returned if no such coremodel exists.
func (r *Registry) Get(name string) (cm Interface, has bool) {
	r.lock.RLock()
	cm, has = r.modelIdx[name]
	r.lock.RUnlock()
	return
}
