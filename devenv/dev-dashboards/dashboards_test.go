package dev_dashboards

import (
	"encoding/json"
	"io"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"

	"cuelang.org/go/cue/errors"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/coremodel/dashboard"
	"github.com/grafana/grafana/pkg/cuectx"
)

func TestDevenvDashboardValidity(t *testing.T) {
	m, err := themaTestableDashboards()
	require.NoError(t, err)
	cm, err := dashboard.ProvideCoremodel(cuectx.ProvideThemaLibrary())
	require.NoError(t, err)

	for path, b := range m {
		t.Run(path, func(t *testing.T) {
			// The path arg here only matters for error output
			cv, err := cuectx.JSONtoCUE(path, b)
			require.NoError(t, err, "error while decoding dashboard JSON into a CUE value")

			_, err = cm.CurrentSchema().Validate(cv)
			if err != nil {
				// Testify trims errors to short length. We want the full text
				errstr := errors.Details(err, nil)
				t.Log(errstr)
				if strings.Contains(errstr, "null") {
					t.Log("validation failure appears to involve nulls - see if scripts/stripnulls.sh has any effect?")
				}
				t.FailNow()
			}
		})
	}
}

func themaTestableDashboards() (map[string][]byte, error) {
	m := make(map[string][]byte)
	in := DevDashboardFS

	err := fs.WalkDir(in, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
			return nil
		}

		// nolint:gosec
		f, err := in.Open(path)
		if err != nil {
			return err
		}
		defer f.Close() // nolint: errcheck

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		jtree := make(map[string]interface{})
		json.Unmarshal(b, &jtree)
		if oldschemav, has := jtree["schemaVersion"]; !has || !(oldschemav.(float64) > dashboard.HandoffSchemaVersion-1) {
			return nil
		}

		m[path] = b
		return nil
	})

	if err != nil {
		return nil, err
	}

	return m, nil
}
