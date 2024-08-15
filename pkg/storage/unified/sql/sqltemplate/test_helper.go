package sqltemplate

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"text/template"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

// func testdata(t *testing.T, filename string) []byte {
// 	t.Helper()
// 	b, err := testdataFS.ReadFile(`testdata/` + filename)
// 	if err != nil {
// 		writeTestData(filename, "<empty>")
// 		assert.Fail(t, "missing test file")
// 	}
// 	return b
// }

// func writeTestData(filename, value string) {
// 	_ = os.WriteFile(filepath.Join("testdata", filename), []byte(value), 0777)
// }

type TemplateTestCase struct {
	Name string

	// Data should be the struct passed to the template.
	Data SQLTemplateIface
}

type TemplateTestSetup struct {
	// Where the snapshots can be found
	RootDir string

	// The template will be run through each dialect
	Dialects []Dialect

	// Check a set of templates against example inputs
	Templates map[*template.Template][]TemplateTestCase
}

func CheckQuerySnapshots(t *testing.T, setup TemplateTestSetup) {
	t.Helper()
	t.Parallel()

	if len(setup.Dialects) < 1 {
		setup.Dialects = []Dialect{
			MySQL,
			SQLite,
			PostgreSQL,
		}
	}

	for tmpl, cases := range setup.Templates {
		t.Run(tmpl.Name(), func(t *testing.T) {
			t.Parallel()

			tname := strings.TrimSuffix(tmpl.Name(), ".sql")
			for _, input := range cases {
				t.Run(input.Name, func(t *testing.T) {
					t.Parallel()

					// If we have an inline raw Args field we can render an inline value
					f := reflect.ValueOf(input.Data).Elem().FieldByName("Args")
					if f.IsValid() {
						a, ok := f.Addr().Interface().(*Args)
						if ok {
							a.inline = true
						}
					}

					for _, dialect := range setup.Dialects {
						t.Run(dialect.DialectName(), func(t *testing.T) {
							// not parallel because we're sharing tc.Data,
							// but also not worth deep cloning
							input.Data.SetDialect(dialect)
							err := input.Data.Validate()

							require.NoError(t, err)
							got, err := Execute(tmpl, input.Data)
							require.NoError(t, err)

							clean := RemoveEmptyLines(got)

							update := false
							fname := fmt.Sprintf("%s--%s-%s.sql", dialect.DialectName(), tname, input.Name)
							fpath := filepath.Join(setup.RootDir, fname)
							expect, err := os.ReadFile(fpath)
							if err != nil || len(expect) < 1 {
								update = true
								t.Errorf("missing " + fpath)
							} else {
								if diff := cmp.Diff(string(expect), clean); diff != "" {
									t.Errorf("%s: %s", fname, diff)
									update = true
								}
							}
							if update {
								_ = os.WriteFile(fpath, []byte(clean), 0777)
							}
						})
					}
				})
			}
		})
	}
}
