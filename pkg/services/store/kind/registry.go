package kind

import (
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/coremodel/playlist"
	"github.com/grafana/grafana/pkg/models"
)

const StandardKindDashboard = "dashboard"
const StandardKindFolder = "folder"
const StandardKindPanel = "panel"         // types: heatmap, timeseries, table, ...
const StandardKindDataSource = "ds"       // types: influx, prometheus, test, ...
const StandardKindTransform = "transform" // types: joinByField, pivot, organizeFields, ...
const StandardKindPlaylist = "playlist"

type kindValues struct {
	info    models.ObjectKindInfo
	builder models.ObjectSummaryBuilder
}

type Registry struct {
	mutex sync.RWMutex
	kinds map[string]*kindValues
	info  []models.ObjectKindInfo
}

func NewKindRegistry() *Registry {
	return &Registry{
		mutex: sync.RWMutex{},
		kinds: make(map[string]*kindValues),
		info:  make([]models.ObjectKindInfo, 0),
	}
}

// Initalize the standard dependency free kinds
func (r *Registry) RegisterDefaults() error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.kinds[StandardKindPlaylist] = &kindValues{
		info:    playlist.GetObjectKindInfo(),
		builder: playlist.GetObjectSummaryBuilder(),
	}

	return nil
}

func (r *Registry) Register(info models.ObjectKindInfo, builder models.ObjectSummaryBuilder) error {
	if info.ID == "" || builder == nil {
		return fmt.Errorf("invalid kind")
	}

	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.kinds[info.ID] != nil {
		return fmt.Errorf("already exits")
	}

	r.kinds[info.ID] = &kindValues{
		info:    info,
		builder: builder,
	}

	// sort?
	r.info = append(r.info, info)
	return nil
}

// GetSummaryBuilder returns a builder or nil if not found
func (r *Registry) GetSummaryBuilder(kind string) models.ObjectSummaryBuilder {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if ok {
		return v.builder
	}
	return nil
}

// GetInfo returns the registered info
func (r *Registry) GetInfo(kind string) (models.ObjectKindInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if ok {
		return v.info, nil
	}
	return models.ObjectKindInfo{}, fmt.Errorf("not found")
}

// GetSummaryBuilder returns a builder or nil if not found
func (r *Registry) GetKinds() []models.ObjectKindInfo {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return r.info // returns a copy of the array
}
