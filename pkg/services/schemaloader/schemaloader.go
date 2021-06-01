package schemaloader

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path/filepath"
	"sync"
	"testing/fstest"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/schema/load"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:     ServiceName,
		Instance: &SchemaLoaderService{},
	})
}

const ServiceName = "SchemaLoader"

type RenderUser struct {
	OrgID   int64
	UserID  int64
	OrgRole string
}
type SchemaLoaderService struct {
	log          log.Logger
	DashFamily   schema.VersionedCueSchema
	Cfg          *setting.Cfg `inject:""`
	pluginFolder string
	baseLoadPath load.BaseLoadPaths
}

type ScueVFS struct {
	sync.Mutex
	fs.FS
	// fstest.MapFS
}

func (r *ScueVFS) SetInstanceFile(key, content string) {
	r.Lock()
	defer r.Unlock()
	r.FS.(fstest.MapFS)[key] = &fstest.MapFile{Data: []byte(content)}
}

func (r *ScueVFS) RemoveInstanceFile(key string) {
	r.Lock()
	defer r.Unlock()
	delete(r.FS.(fstest.MapFS), key)
}

func (rs *SchemaLoaderService) LoadNewPanelPluginSchema(name, content string) error {
	cueFile := filepath.Join(rs.pluginFolder, name+".cue")
	rs.log.Info("Write file into virtual file system", "file", cueFile)
	rs.baseLoadPath.InstanceCueFS.(*ScueVFS).SetInstanceFile(cueFile, content)
	return nil
}

func (rs *SchemaLoaderService) RemovePanelPluginSchema(name string) error {
	cueFile := filepath.Join(rs.pluginFolder, name+".cue")
	rs.log.Info("Delete file from virtual file system", "file", cueFile)
	rs.baseLoadPath.InstanceCueFS.(*ScueVFS).RemoveInstanceFile(cueFile)
	return nil
}

func (rs *SchemaLoaderService) Init() error {
	defaultLoadPaths := load.GetDefaultLoadPaths()
	rs.pluginFolder = filepath.Join("public", "app", "plugins")
	rs.baseLoadPath = load.BaseLoadPaths{
		BaseCueFS:       defaultLoadPaths.BaseCueFS,
		DistPluginCueFS: defaultLoadPaths.DistPluginCueFS,
		InstanceCueFS:   &ScueVFS{},
	}
	rs.baseLoadPath.InstanceCueFS.(*ScueVFS).FS.(fstest.MapFS)[rs.pluginFolder] = &fstest.MapFile{Mode: fs.ModeDir}

	rs.log = log.New("schemaloader")
	var err error
	rs.DashFamily, err = load.BaseDashboardFamily(rs.baseLoadPath)

	if err != nil {
		return fmt.Errorf("failed to load dashboard cue schema from path %q: %w", rs.baseLoadPath, err)
	}
	return nil
}

func (rs *SchemaLoaderService) IsDisabled() bool {
	if rs.Cfg == nil {
		return true
	}
	return !rs.Cfg.IsTrimDefaultsEnabled()
}

func (rs *SchemaLoaderService) DashboardApplyDefaults(input *simplejson.Json) (*simplejson.Json, error) {
	val, _ := input.Map()
	val = removeNils(val)
	data, _ := json.Marshal(val)
	dsSchema := schema.Find(rs.DashFamily, schema.Latest())
	result, err := schema.ApplyDefaults(schema.Resource{Value: data}, dsSchema.CUE())
	if err != nil {
		return input, err
	}
	output, err := simplejson.NewJson([]byte(result.Value.(string)))
	if err != nil {
		return input, err
	}
	return output, nil
}

func (rs *SchemaLoaderService) DashboardTrimDefaults(input simplejson.Json) (simplejson.Json, error) {
	val, _ := input.Map()
	val = removeNils(val)
	data, _ := json.Marshal(val)

	dsSchema, err := schema.SearchAndValidate(rs.DashFamily, data)
	if err != nil {
		return input, err
	}

	result, err := schema.TrimDefaults(schema.Resource{Value: data}, dsSchema.CUE())
	if err != nil {
		return input, err
	}
	output, err := simplejson.NewJson([]byte(result.Value.(string)))
	if err != nil {
		return input, err
	}
	return *output, nil
}

func removeNils(initialMap map[string]interface{}) map[string]interface{} {
	withoutNils := map[string]interface{}{}
	for key, value := range initialMap {
		if _, ok := value.(map[string]interface{}); ok {
			value = removeNils(value.(map[string]interface{}))
			withoutNils[key] = value
			continue
		}
		if _, ok := value.([]interface{}); ok {
			value = removeNilArray(value.([]interface{}))
			withoutNils[key] = value
			continue
		}
		if value != nil {
			if val, ok := value.(string); ok {
				if val == "" {
					continue
				}
			}
			withoutNils[key] = value
		}
	}
	return withoutNils
}

func removeNilArray(initialArray []interface{}) []interface{} {
	withoutNils := []interface{}{}
	for _, value := range initialArray {
		if _, ok := value.(map[string]interface{}); ok {
			value = removeNils(value.(map[string]interface{}))
			withoutNils = append(withoutNils, value)
			continue
		}
		if _, ok := value.([]interface{}); ok {
			value = removeNilArray(value.([]interface{}))
			withoutNils = append(withoutNils, value)
			continue
		}
		if value != nil {
			if val, ok := value.(string); ok {
				if val == "" {
					continue
				}
			}
			withoutNils = append(withoutNils, value)
		}
	}
	return withoutNils
}
