package load

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"

	"cuelang.org/go/cue"
	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/schema"
	"golang.org/x/tools/txtar"
)

var CasesDir = filepath.Join("testdata", "artifacts", "dashboards", "trimdefault")

type Case struct {
	Name string

	CUE    string
	Full   string
	Trimed string
}

func TestGenerate(t *testing.T) {
	cases, err := loadCases(CasesDir)
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range cases {
		t.Run(c.Name+" apply default value", func(t *testing.T) {
			var r cue.Runtime
			scmInstance, err := r.Compile(c.Name+".cue", c.CUE)
			if err != nil {
				t.Fatal(err)
			}
			inputResource := schema.Resource{Value: c.Trimed}
			scm := genericVersionedSchema{actual: scmInstance.Value()}
			out, err := scm.ApplyDefaults(inputResource)
			if err != nil {
				t.Fatal(err)
			}
			b := []byte(out.Value.(string))

			if s := cmp.Diff(string(b), c.Full); s != "" {
				t.Fatal(s)
			}
		})
	}

	t.Skip()
	for _, c := range cases {
		t.Run(c.Name+" trim default value", func(t *testing.T) {
			var r cue.Runtime
			scmInstance, err := r.Compile(c.Name+".cue", c.CUE)
			if err != nil {
				t.Fatal(err)
			}
			inputResource := schema.Resource{Value: c.Full}
			scm := genericVersionedSchema{actual: scmInstance.Value()}
			out, err := scm.TrimDefaults(inputResource)
			if err != nil {
				t.Fatal(err)
			}
			b := []byte(out.Value.(string))
			if s := cmp.Diff(string(b), c.Trimed); s != "" {
				t.Fatal(s)
			}
		})
	}
}

func loadCases(dir string) ([]Case, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var cases []Case

	for _, fi := range files {
		file := filepath.Join(dir, fi.Name())
		a, err := txtar.ParseFile(file)
		if err != nil {
			return nil, err
		}

		if len(a.Files) != 3 {
			return nil, fmt.Errorf("Malformed test case '%s': Must contain exactly three files (CUE, Full and Trimed), but has %d", file, len(a.Files))
		}

		fullBuffer := new(bytes.Buffer)
		fullJson := a.Files[1].Data
		if err := json.Compact(fullBuffer, fullJson); err != nil {
			return nil, err
		}

		trimBuffer := new(bytes.Buffer)
		trimedJson := a.Files[2].Data
		if err := json.Compact(trimBuffer, trimedJson); err != nil {
			return nil, err
		}

		cases = append(cases, Case{
			Name:   fi.Name(),
			CUE:    string(a.Files[0].Data),
			Full:   fullBuffer.String(),
			Trimed: trimBuffer.String(),
		})
	}

	return cases, nil
}
