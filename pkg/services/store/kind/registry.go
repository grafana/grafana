package kind

import (
	"fmt"
	"sort"
	"sync"

	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/store/kind/dataframe"
	"github.com/grafana/grafana/pkg/services/store/kind/folder"
	"github.com/grafana/grafana/pkg/services/store/kind/geojson"
	"github.com/grafana/grafana/pkg/services/store/kind/jsonobj"
	"github.com/grafana/grafana/pkg/services/store/kind/playlist"
	"github.com/grafana/grafana/pkg/services/store/kind/png"
	"github.com/grafana/grafana/pkg/services/store/kind/preferences"
	"github.com/grafana/grafana/pkg/services/store/kind/snapshot"
	"github.com/grafana/grafana/pkg/services/store/kind/svg"
	"github.com/grafana/grafana/pkg/setting"
)

type KindRegistry interface {
	Register(info entity.EntityKindInfo, builder entity.EntitySummaryBuilder) error
	GetSummaryBuilder(kind string) entity.EntitySummaryBuilder
	GetInfo(kind string) (entity.EntityKindInfo, error)
	GetFromExtension(suffix string) (entity.EntityKindInfo, error)
	GetKinds() []entity.EntityKindInfo
}

func NewKindRegistry() KindRegistry {
	kinds := make(map[string]*kindValues)
	kinds[entity.StandardKindPlaylist] = &kindValues{
		info:    playlist.GetEntityKindInfo(),
		builder: playlist.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindDashboard] = &kindValues{
		info:    dashboard.GetEntityKindInfo(),
		builder: dashboard.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindSnapshot] = &kindValues{
		info:    snapshot.GetEntityKindInfo(),
		builder: snapshot.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindFolder] = &kindValues{
		info:    folder.GetEntityKindInfo(),
		builder: folder.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindPNG] = &kindValues{
		info:    png.GetEntityKindInfo(),
		builder: png.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindGeoJSON] = &kindValues{
		info:    geojson.GetEntityKindInfo(),
		builder: geojson.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindDataFrame] = &kindValues{
		info:    dataframe.GetEntityKindInfo(),
		builder: dataframe.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindJSONObj] = &kindValues{
		info:    jsonobj.GetEntityKindInfo(),
		builder: jsonobj.GetEntitySummaryBuilder(),
	}
	kinds[entity.StandardKindPreferences] = &kindValues{
		info:    preferences.GetEntityKindInfo(),
		builder: preferences.GetEntitySummaryBuilder(),
	}

	// create a registry
	reg := &registry{
		mutex: sync.RWMutex{},
		kinds: kinds,
	}
	reg.updateInfoArray()
	return reg
}

// TODO? This could be a zero dependency service that others are responsible for configuring
func ProvideService(cfg *setting.Cfg, renderer rendering.Service) KindRegistry {
	reg := NewKindRegistry()

	// Register SVG support
	//-----------------------
	info := svg.GetEntityKindInfo()
	allowUnsanitizedSvgUpload := cfg != nil && cfg.Storage.AllowUnsanitizedSvgUpload
	support := svg.GetEntitySummaryBuilder(allowUnsanitizedSvgUpload, renderer)
	_ = reg.Register(info, support)

	return reg
}

type kindValues struct {
	info    entity.EntityKindInfo
	builder entity.EntitySummaryBuilder
}

type registry struct {
	mutex  sync.RWMutex
	kinds  map[string]*kindValues
	info   []entity.EntityKindInfo
	suffix map[string]entity.EntityKindInfo
}

func (r *registry) updateInfoArray() {
	suffix := make(map[string]entity.EntityKindInfo)
	info := make([]entity.EntityKindInfo, 0, len(r.kinds))
	for _, v := range r.kinds {
		info = append(info, v.info)
		if v.info.FileExtension != "" {
			suffix[v.info.FileExtension] = v.info
		}
	}
	sort.Slice(info, func(i, j int) bool {
		return info[i].ID < info[j].ID
	})
	r.info = info
	r.suffix = suffix
}

func (r *registry) Register(info entity.EntityKindInfo, builder entity.EntitySummaryBuilder) error {
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
func (r *registry) GetSummaryBuilder(kind string) entity.EntitySummaryBuilder {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if !ok {
		// fallback to default
		v, ok = r.kinds[entity.StandardKindJSONObj]
	}
	if ok {
		return v.builder
	}
	return nil
}

// GetInfo returns the registered info
func (r *registry) GetInfo(kind string) (entity.EntityKindInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.kinds[kind]
	if ok {
		return v.info, nil
	}
	return entity.EntityKindInfo{}, fmt.Errorf("not found")
}

// GetInfo returns the registered info
func (r *registry) GetFromExtension(suffix string) (entity.EntityKindInfo, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	v, ok := r.suffix[suffix]
	if ok {
		return v, nil
	}
	return entity.EntityKindInfo{}, fmt.Errorf("not found")
}

// GetSummaryBuilder returns a builder or nil if not found
func (r *registry) GetKinds() []entity.EntityKindInfo {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return r.info // returns a copy of the array
}
