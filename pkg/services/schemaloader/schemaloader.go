package schemaloader

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"time"

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
	baseLoadPath load.BaseLoadPaths
}

func (rs *SchemaLoaderService) LoadNewPanelPluginSchema(name, content string) error {
	if err := rs.baseLoadPath.InstanceCueFS.(*InstanceFS).WriteFile(name, content); err != nil {
		return err
	}
	return nil
}

func (rs *SchemaLoaderService) Init() error {

	rs.baseLoadPath = load.GetDefaultLoadPaths()
	rs.baseLoadPath.InstanceCueFS = NewInstanceFS()

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

type file struct {
	name    string
	content *bytes.Buffer
	modTime time.Time
	closed  bool
}

func (f *file) Read(p []byte) (int, error) {
	if f.closed {
		return 0, errors.New("file closed")
	}
	return f.content.Read(p)
}

func (f *file) Stat() (fs.FileInfo, error) {
	if f.closed {
		return nil, errors.New("file closed")
	}
	return f, nil
}

func (f *file) Close() error {
	f.closed = true
	return nil
}

func (f *file) Name() string {
	return f.name
}

func (f *file) Size() int64 {
	return int64(f.content.Len())
}

func (f *file) Mode() fs.FileMode {
	return 0444
}

func (f *file) ModTime() time.Time {
	return f.modTime
}

func (f *file) IsDir() bool {
	return false
}

func (f *file) Sys() interface{} {
	return nil
}

type InstanceFS struct {
	files map[string]*file
}

func NewInstanceFS() *InstanceFS {
	return &InstanceFS{
		files: make(map[string]*file),
	}
}

func (fsys InstanceFS) Open(name string) (fs.File, error) {
	if !fs.ValidPath(name) {
		return nil, &fs.PathError{
			Op:   "open",
			Path: name,
			Err:  fs.ErrInvalid,
		}
	}

	if f, ok := fsys.files[name]; !ok {
		return nil, &fs.PathError{
			Op:   "open",
			Path: name,
			Err:  fs.ErrNotExist,
		}
	} else {
		return f, nil
	}
}

func (fsys *InstanceFS) WriteFile(name, content string) error {
	if !fs.ValidPath(name) {
		return &fs.PathError{
			Op:   "write",
			Path: name,
			Err:  fs.ErrInvalid,
		}
	}

	f := &file{
		name:    name,
		content: bytes.NewBufferString(content),
		modTime: time.Now(),
	}
	fsys.files[name] = f
	return nil
}
