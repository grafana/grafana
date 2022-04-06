package components

import (
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/schema"
)

var (
	// ErrModelAlreadyRegistered is returned when trying to register duplicate model to Registry.
	ErrModelAlreadyRegistered = errors.New("error registering duplicate model")
)

// KubeControllerRegistry is a registry of KubeControllers.
type KubeControllerRegistry struct {
	lock     sync.RWMutex
	models   []KubeController
	modelIdx map[registryKey]KubeController
}

// NewKubeControllerRegistry returns a new KubeControllerRegistry with the provided KubeControllers.
func NewKubeControllerRegistry(models ...KubeController) (*KubeControllerRegistry, error) {
	r := &KubeControllerRegistry{
		models:   make([]KubeController, 0, len(models)),
		modelIdx: make(map[registryKey]KubeController, len(models)),
	}

	if err := r.addModels(models); err != nil {
		return nil, err
	}

	return r, nil
}

// Register adds models to the Registry.
func (r *KubeControllerRegistry) Register(models ...KubeController) error {
	return r.addModels(models)
}

// List returns all coremodels registered in this Registry.
func (r *KubeControllerRegistry) List() []KubeController {
	r.lock.RLock()
	defer r.lock.RUnlock()

	return r.models
}

func (r *KubeControllerRegistry) addModels(models []KubeController) error {
	r.lock.Lock()
	defer r.lock.Unlock()

	// Update model index and return an error if trying to register a duplicate.
	for _, m := range models {
		k := makeRegistryKey(m.CRD())

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

type registryKey struct {
	modelName    string
	groupName    string
	groupVersion string
}

func makeRegistryKey(s schema.CRD) registryKey {
	return registryKey{
		modelName:    s.Name(),
		groupName:    s.GroupName(),
		groupVersion: s.GroupVersion(),
	}
}
