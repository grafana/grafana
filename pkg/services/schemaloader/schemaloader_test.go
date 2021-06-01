package schemaloader

import (
	"io/fs"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/schema/load"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestSchemaLoader(t *testing.T) {
	Lpath := load.GetDefaultLoadPaths()
	dashFamily, _ := load.BaseDashboardFamily(Lpath)
	rs := &SchemaLoaderService{
		log:          log.New("schemaloader"),
		DashFamily:   dashFamily,
		Cfg:          setting.NewCfg(),
		pluginFolder: filepath.Join("public", "app", "plugins"),
		baseLoadPath: load.BaseLoadPaths{
			BaseCueFS:       Lpath.BaseCueFS,
			DistPluginCueFS: Lpath.DistPluginCueFS,
			InstanceCueFS:   &ScueVFS{},
		},
	}

	rs.baseLoadPath.InstanceCueFS = fstest.MapFS{
		rs.pluginFolder: &fstest.MapFile{Mode: fs.ModeDir},
		filepath.Join(rs.pluginFolder, "22222.cue"): &fstest.MapFile{Data: []byte("Test data")},
	}

	t.Run("Write to virtual file system with new external plugin schema", func(t *testing.T) {
		name := "11111"
		fileFullPath := filepath.Join(rs.pluginFolder, name+".cue")
		content := "This is a test file for the virtual file system"
		err := rs.LoadNewPanelPluginSchema(name, content)
		if err != nil {
			t.Fatal(err)
		}
		f, err := rs.baseLoadPath.InstanceCueFS.Open(fileFullPath)
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

	t.Run("Delete from virtual file system the external plugin schema", func(t *testing.T) {
		name := "22222"
		fileFullPath := filepath.Join(rs.pluginFolder, name+".cue")
		err := rs.RemovePanelPluginSchema(name)
		if err != nil {
			t.Fatal(err)
		}
		_, ok := rs.baseLoadPath.InstanceCueFS.(fstest.MapFS)[fileFullPath]
		require.False(t, ok)
	})

	t.Run("Concurrency test on virtual file system", func(t *testing.T) {
		content := "This is a test file for the virtual file system"
		var wg sync.WaitGroup
		wg.Add(10)
		for i := 1; i <= 10; i++ {
			go func(name string) {
				rs.LoadNewPanelPluginSchema(name, content)
				wg.Done()
			}(strconv.Itoa(i))
		}
		wg.Wait()

		t.Run("check files are created successfully", func(t *testing.T) {
			for i := 1; i <= 10; i++ {
				f, err := rs.baseLoadPath.InstanceCueFS.Open(filepath.Join(rs.pluginFolder, strconv.Itoa(i)+".cue"))
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
			}
		})
	})
}
