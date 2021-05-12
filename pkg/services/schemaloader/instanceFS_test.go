package schemaloader

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSchemaLoader(t *testing.T) {

	Lpath := load.GetDefaultLoadPaths()
	Lpath.InstanceCueFS = NewInstanceFS()
	dashFamily, _ := load.BaseDashboardFamily(Lpath)

	rs := &SchemaLoaderService{
		log:          log.New("schemaloader"),
		DashFamily:   dashFamily,
		Cfg:          setting.NewCfg(),
		baseLoadPath: Lpath,
	}

	t.Run("Write to virtual file system with new external plugin schema", func(t *testing.T) {
		name := "x/y/name.txt"
		content := "This is a test file for the virtual file system"
		err := rs.LoadNewPanelPluginSchema(name, content)
		if err != nil {
			t.Fatal(err)
		}
		f, err := rs.baseLoadPath.InstanceCueFS.Open(name)
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			_ = f.Close()
		}()

		fi, err := f.Stat()
		if err != nil {
			t.Fatal(err)
		}
		t.Log(fi.Name(), fi.Size(), fi.ModTime())
		var result = make([]byte, int(fi.Size()))
		n, err := f.Read(result)
		if err != nil {
			t.Fatal(err)
		}

		if string(result[:n]) != content {
			t.Errorf("expect: %s, actual: %s", content, result[:n])
		}
	})
}
