package kind

import (
	"fmt"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/kind/playlist"
)

const StandardKindDashboard = "dashboard"
const StandardKindFolder = "folder"
const StandardKindPanel = "panel"         // types: heatmap, timeseries, table, ...
const StandardKindDataSource = "ds"       // types: influx, prometheus, test, ...
const StandardKindTransform = "transform" // types: joinByField, pivot, organizeFields, ...
const StandardKindPlaylist = "playlist"
const StandardKindSVG = "svg"

type KindRegistry interface {
	Register(info models.ObjectKindInfo, builder models.ObjectSummaryBuilder) error
	GetSummaryBuilder(kind string) models.ObjectSummaryBuilder
	GetInfo(kind string) (models.ObjectKindInfo, error)
	GetKinds() []models.ObjectKindInfo
}

func NewKindRegistry() KindRegistry {
	kinds := make(map[string]*kindValues)
	kinds[StandardKindPlaylist] = &kindValues{
		info:    playlist.GetObjectKindInfo(),
		builder: playlist.GetObjectSummaryBuilder(),
	}

	reg := &registry{
		mutex: sync.RWMutex{},
		kinds: kinds,
	}
	// Add each item
	for _, k := range kinds {
		reg.info = append(reg.info, k.info)
	}
	return reg
}

// Zero dependency service -- this includes the default services
func ProvideService() KindRegistry {
	return NewKindRegistry()
}

type kindValues struct {
	info    models.ObjectKindInfo
	builder models.ObjectSummaryBuilder
}

type registry struct {
	mutex sync.RWMutex
	kinds map[string]*kindValues
	info  []models.ObjectKindInfo
}

func (r *registry) Register(info models.ObjectKindInfo, builder models.ObjectSummaryBuilder) error {
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
func (r *registry) GetSummaryBuilder(kind string) models.ObjectSummaryBuilder {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if ok {
		return v.builder
	}
	return nil
}

// GetInfo returns the registered info
func (r *registry) GetInfo(kind string) (models.ObjectKindInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if ok {
		return v.info, nil
	}
	return models.ObjectKindInfo{}, fmt.Errorf("not found")
}

// GetSummaryBuilder returns a builder or nil if not found
func (r *registry) GetKinds() []models.ObjectKindInfo {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return r.info // returns a copy of the array
}

func GuessNameFromUID(uid string) string {
	sidx := strings.LastIndex(uid, "/") + 1
	didx := strings.LastIndex(uid, ".")
	if didx > sidx && didx != sidx {
		return uid[sidx:didx]
	}
	if sidx > 0 {
		return uid[sidx:]
	}
	return uid
}
