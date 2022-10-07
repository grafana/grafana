package kind

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/kind/dummy"
	"github.com/grafana/grafana/pkg/services/store/kind/playlist"
)

const StandardKindDashboard = "dashboard"
const StandardKindFolder = "folder"
const StandardKindPanel = "panel"         // types: heatmap, timeseries, table, ...
const StandardKindDataSource = "ds"       // types: influx, prometheus, test, ...
const StandardKindTransform = "transform" // types: joinByField, pivot, organizeFields, ...
const StandardKindPlaylist = "playlist"
const StandardKindSVG = "svg"

// Query library
const StandardKindQuery = "query"

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

	// FIXME -- these are registered because existing tests use them
	for _, k := range []string{"kind1", "kind2", "kind3"} {
		kinds[k] = &kindValues{
			info:    dummy.GetObjectKindInfo(k),
			builder: dummy.GetObjectSummaryBuilder(k),
		}
	}

	// create a registry
	reg := &registry{
		mutex: sync.RWMutex{},
		kinds: kinds,
	}
	reg.updateInfoArray()
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

func (r *registry) updateInfoArray() {
	info := make([]models.ObjectKindInfo, 0, len(r.kinds))
	for _, v := range r.kinds {
		info = append(info, v.info)
	}
	sort.Slice(info, func(i, j int) bool {
		return info[i].ID < info[j].ID
	})
	r.info = info
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
	r.updateInfoArray()
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
