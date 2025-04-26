package mocks

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	reflect "reflect"
	"strings"
	"testing"
	"text/template"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	sqltemplate "github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

func NewTestingSQLTemplate() sqltemplate.SQLTemplate {
	standard := sqltemplate.New(sqltemplate.MySQL) // dialect gets replaced at each iteration
	return &testingSQLTemplate{standard}
}

type testingSQLTemplate struct {
	sqltemplate.SQLTemplate
}

func (t *testingSQLTemplate) Arg(x any) string {
	_ = t.SQLTemplate.Arg(x) // discard the output

	switch v := reflect.ValueOf(x); {
	case v.Kind() == reflect.Bool:
		if v.Bool() {
			return "TRUE"
		}
		return "FALSE"

	case v.CanInt(), v.CanUint(), v.CanFloat():
		_, ok := x.(fmt.Stringer)
		if !ok {
			return fmt.Sprintf("%v", x)
		}
	}

	return fmt.Sprintf("'%v'", x) // single quotes
}

func (t *testingSQLTemplate) ArgList(slice reflect.Value) (string, error) {
	// Copied from upstream Arg
	if !slice.IsValid() || slice.Kind() != reflect.Slice {
		return "", sqltemplate.ErrInvalidArgList
	}
	sliceLen := slice.Len()
	if sliceLen == 0 {
		return "", nil
	}

	var b strings.Builder
	b.Grow(3*sliceLen - 2) // the list will be ?, ?, ?
	for i, l := 0, slice.Len(); i < l; i++ {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(t.Arg(slice.Index(i).Interface()))
	}

	return b.String(), nil
}

type TemplateTestCase struct {
	Name string

	// Data should be the struct passed to the template.
	Data sqltemplate.SQLTemplate
}

type TemplateTestSetup struct {
	// Where the snapshots can be found
	RootDir string

	// The template will be run through each dialect
	Dialects []sqltemplate.Dialect

	// Check a set of templates against example inputs
	Templates map[*template.Template][]TemplateTestCase

	// The (embedded) filesystem containing the SQL query templates
	// If not nil, a test will be run to ensure all templates in that folder have a test-case
	SQLTemplatesFS fs.FS
}

func CheckQuerySnapshots(t *testing.T, setup TemplateTestSetup) {
	t.Helper()
	t.Parallel()

	if len(setup.Dialects) < 1 {
		setup.Dialects = []sqltemplate.Dialect{
			sqltemplate.MySQL,
			sqltemplate.SQLite,
			sqltemplate.PostgreSQL,
		}
	}

	if setup.SQLTemplatesFS != nil {
		ensureAllTemplatesHaveTestCases(t, setup)
	}

	for tmpl, cases := range setup.Templates {
		t.Run(tmpl.Name(), func(t *testing.T) {
			t.Parallel()

			tname := strings.TrimSuffix(tmpl.Name(), ".sql")
			for _, input := range cases {
				t.Run(input.Name, func(t *testing.T) {
					t.Parallel()

					require.NotPanics(t, func() {
						for _, dialect := range setup.Dialects {
							t.Run(dialect.DialectName(), func(t *testing.T) {
								// not parallel because we're sharing tc.Data,
								// but also not worth deep cloning
								input.Data.SetDialect(dialect)
								err := input.Data.Validate()

								require.NoError(t, err)
								got, err := sqltemplate.Execute(tmpl, input.Data)
								require.NoError(t, err)

								clean := sqltemplate.RemoveEmptyLines(got)

								update := false
								fname := fmt.Sprintf("%s--%s-%s.sql", dialect.DialectName(), tname, input.Name)
								fpath := filepath.Join(setup.RootDir, fname)

								// We can ignore the gosec G304 because this is only for tests
								// nolint:gosec
								expect, err := os.ReadFile(fpath)
								if err != nil || len(expect) < 1 {
									update = true
									t.Error("missing " + fpath)
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
				})
			}
		})
	}
}

func ensureAllTemplatesHaveTestCases(t *testing.T, setup TemplateTestSetup) {
	t.Helper()

	// Folder containing SQL query templates
	sqlFiles := make([]string, 0, len(setup.Templates))
	err := fs.WalkDir(setup.SQLTemplatesFS, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		if name := d.Name(); strings.HasSuffix(name, ".sql") {
			sqlFiles = append(sqlFiles, name)
		}

		return nil
	})
	require.NoError(t, err)

	// Makes sure all SQL files in the folder have a test-case
	for _, file := range sqlFiles {
		found := false

		for template := range setup.Templates {
			if template.Name() == file {
				found = true
				break
			}
		}

		assert.True(t, found, "File '%s' does not have a test case", file)
	}
}
