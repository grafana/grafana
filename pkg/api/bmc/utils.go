package bmc

import (
	"archive/zip"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	plugin "github.com/grafana/grafana/pkg/api/bmc/import_export_plugin"
	"github.com/grafana/grafana/pkg/components/simplejson"
)

const (
	//BMC Code : Start
	//role constants to check valid permissions for logged in user
	ReportingViewer = "reporting.dashboards_permissions.viewer"
	ReportingEditor = "reporting.dashboards_permissions.editor"
	ReportingAdmin  = "reporting.dashboards_permissions.admin"
	//BMC Code : End
)

func createZip(zipFilePath, tmpFolderPath string) *plugin.ErrorResult {
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		return plugin.NewErrorResult("Failed to create archive", err)
	}
	defer zipFile.Close()

	// Initialize the zip writer.
	z := zip.NewWriter(zipFile)
	defer z.Close()

	// Zip up the sourceDirPath, files and directories, recursively.
	err = filepath.WalkDir(tmpFolderPath, func(path string, d fs.DirEntry, err error) error {
		// Error with path.
		if err != nil {
			return err
		}

		// Skip directories. Directories will be created automatically from paths to
		// each file to zip up.
		if d.IsDir() {
			return nil
		}

		// Handle formatting path name properly for use in zip file. Paths must be
		// relative, not start with a slash character, and must use forward slashes,
		// even on Windows.  See: https://pkg.go.dev/archive/zip#Writer.Create
		//
		// Directories are created automatically based on the subdirectories provided
		// in each file's path.
		zipPath := strings.Replace(path, tmpFolderPath, "", 1)
		zipPath = strings.TrimPrefix(zipPath, string(filepath.Separator))
		zipPath = filepath.ToSlash(zipPath)

		// Open the path to read from.
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()

		// Create the path in the zip.
		w, err := z.Create(zipPath)
		if err != nil {
			return err
		}

		// Write the source file into the zip at path from Create().
		_, err = io.Copy(w, f)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return plugin.NewErrorResult("Failed to create archive", err)
	}
	z.Close()

	return nil
}

func prepareInputs(datasources []*plugin.Datasource) map[string]*simplejson.Json {
	//create a map
	inputs := make(map[string]*simplejson.Json, 0)
	for _, ds := range datasources {
		name := fmt.Sprintf("DS_%s", strings.ReplaceAll(strings.ToUpper(ds.Name), " ", "_"))
		input := simplejson.New()
		input.Set("name", name)
		input.Set("label", ds.Name)
		input.Set("type", "datasource")
		input.Set("pluginId", ds.PluginID)
		input.Set("pluginName", ds.Name)
		if inputs[ds.UID] == nil {
			inputs[ds.UID] = input
		}
	}
	return inputs
}

func prepareVariableInputs(variables []*simplejson.Json) []*simplejson.Json {
	//create a map
	inputs := make([]*simplejson.Json, 0)
	for _, variable := range variables {
		variableType := variable.Get("type").MustString("")
		name := variable.Get("name").MustString()
		name = fmt.Sprintf("VAR_%s", strings.ReplaceAll(strings.ToUpper(name), " ", "_"))
		var value string
		if variableType == "constant" {
			value = variable.Get("queryvalue").MustString()
		} else {
			value = variable.Get("query").MustString()
		}
		label := variable.Get("name").MustString()
		typeOf := variable.Get("type").MustString()
		input := simplejson.New()
		input.Set("name", name)
		input.Set("label", label)
		input.Set("value", value)
		input.Set("type", typeOf)
		input.Set("description", "")
		inputs = append(inputs, input)
	}
	return inputs
}

func Contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

func StrToInt64(s string) int64 {
	i, _ := strconv.ParseInt(s, 10, 64)
	return i
}

func StrToInt64s(s []string) []int64 {
	var i []int64
	for _, v := range s {
		i = append(i, StrToInt64(v))
	}
	return i
}

// SlicesAreEqual - compare two string slices
func SlicesAreEqual(a, b []int64) bool {
	sort.Slice(a, func(i, j int) bool { return a[i] < a[j] })
	sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
	if len(a) != len(b) {
		return false
	}
	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}

func find(what int64, where []int64) (idx int) {
	for i, v := range where {
		if v == what {
			return i
		}
	}
	return -1
}

// End Abhishek_06202020, Team membership changes

// Start Abhishek_06292020, roleupdate
// Moved from context handled
func ContainsLower(s []string, searchterm string) bool {
	i := sort.SearchStrings(s, searchterm)
	return i < len(s) && strings.ToLower(s[i]) == searchterm
}

func ContainsInt(s []int64, item int64) bool {
	for _, v := range s {
		if v == item {
			return true
		}
	}
	return false
}
