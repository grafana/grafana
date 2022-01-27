package datasource

import (
	"embed"
	"io"
	"io/fs"
	"path/filepath"
	"testing/fstest"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/thema"
	"github.com/grafana/thema/kernel"
	"github.com/grafana/thema/load"
	"k8s.io/apimachinery/pkg/runtime"
)

var sch *schema.ThemaSchema

func init() {
	// FIXME derive lib from some central place
	lib := thema.NewLibrary(cuecontext.New())
	lin, err := DatasourceLineage(lib)
	if err != nil {
		panic(err)
	}
	sch := &schema.ThemaSchema{
		Lineage: lin,
	}
	schema.RegisterCoreSchema(sch)
}

//go:embed datasource.cue
var cueFS embed.FS

func DatasourceLineage(lib thema.Library, opts ...thema.BindOption) (thema.Lineage, error) {
	linval, err := loadDatasourceLineage(lib)
	if err != nil {
		return nil, err
	}
	return thema.BindLineage(linval, lib, opts...)
}

func loadDatasourceLineage(lib thema.Library) (cue.Value, error) {
	prefix := filepath.FromSlash("internal/components/datasource")
	fs, err := prefixWithGrafanaCUE(prefix, cueFS)
	if err != nil {
		return cue.Value{}, err
	}
	inst, err := load.InstancesWithThema(fs, prefix)

	// Need to trick loading by creating the embedded file and
	// making it look like a module in the root dir.
	if err != nil {
		return cue.Value{}, err
	}

	return lib.Context().BuildInstance(inst), nil
}

var _ thema.LineageFactory = DatasourceLineage

func newDataSourceJSONKernel(lin thema.Lineage) kernel.InputKernel {
	jdk, err := kernel.NewInputKernel(kernel.InputKernelConfig{
		Lineage:     lin,
		Loader:      kernel.NewJSONDecoder("datasource.cue"),
		To:          thema.SV(0, 0),
		TypeFactory: func() interface{} { return &DataSource{} },
	})
	if err != nil {
		// Panic here guarantees that our program cannot start if the Go ship type is
		// not aligned with the shipVersion schema from our lineage
		panic(err)
	}
	return jdk
}

type DataSource struct {
	// Omitting these two at least for now, because sequential IDs == :(
	// Id                int64                  `json:"id"`
	// OrgId             int64                  `json:"orgId"`

	//UID         string `json:"uid"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	TypeLogoUrl string `json:"typeLogoUrl"`
	// Access            models.DsAccess        `json:"access"`
	Access            string `json:"access"` // enum: "proxy" | "direct"
	Url               string `json:"url"`
	Password          string `json:"password"`
	User              string `json:"user"`
	Database          string `json:"database"`
	BasicAuth         bool   `json:"basicAuth"`
	BasicAuthUser     string `json:"basicAuthUser"`
	BasicAuthPassword string `json:"basicAuthPassword"`
	//WithCredentials   bool   `json:"withCredentials"`
	//IsDefault         bool   `json:"isDefault"`
	// JsonData          *simplejson.Json       `json:"jsonData,omitempty"`
	JsonData map[string]interface{} `json:"jsonData,omitempty"`
	//SecureJsonFields map[string]bool        `json:"secureJsonFields"`
	//Version          int                    `json:"version"`
	//ReadOnly         bool                   `json:"readOnly"`
	// AccessControl     accesscontrol.Metadata `json:"accessControl,omitempty"`
	//AccessControl map[string]bool `json:"accessControl,omitempty"`
}

func (ds *DataSource) DeepCopyObject() runtime.Object {
	panic("not implemented")
}

func prefixWithGrafanaCUE(prefix string, inputfs fs.FS) (fs.FS, error) {
	m := fstest.MapFS{
		filepath.Join("cue.mod", "module.cue"): &fstest.MapFile{Data: []byte(`module: "github.com/grafana/grafana"`)},
	}

	prefix = filepath.FromSlash(prefix)
	err := fs.WalkDir(inputfs, ".", (func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		f, err := inputfs.Open(path)
		if err != nil {
			return err
		}

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		m[filepath.Join(prefix, path)] = &fstest.MapFile{Data: []byte(b)}
		return nil
	}))

	return m, err
}
