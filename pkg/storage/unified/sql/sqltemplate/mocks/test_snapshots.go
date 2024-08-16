package mocks

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"text/template"

	"github.com/google/go-cmp/cmp"
	sqltemplate "github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/stretchr/testify/require"
)

func NewTestingSQLTemplate() sqltemplate.SQLTemplateIface {
	standard := sqltemplate.New(nil) // dialect gets replaced at each iteration
	return &testingSQLTemplate{standard}
}

type testingSQLTemplate struct {
	*sqltemplate.SQLTemplate
}

func (t *testingSQLTemplate) Arg(x any) string {
	t.SQLTemplate.Arg(x) // discard the output

	// Return the raw values in the template
	switch val := x.(type) {
	case bool:
		if val {
			return "TRUE"
		}
		return "FALSE"

	case int, int16, int32, int64,
		uint, uint16, uint32, uint64,
		float32, float64:
		return fmt.Sprintf("%v", x)

	default:
		return fmt.Sprintf("'%v'", x) // single quotes
	}
}

type TemplateTestCase struct {
	Name string

	// Data should be the struct passed to the template.
	Data sqltemplate.SQLTemplateIface
}

type TemplateTestSetup struct {
	// Where the snapshots can be found
	RootDir string

	// The template will be run through each dialect
	Dialects []sqltemplate.Dialect

	// Check a set of templates against example inputs
	Templates map[*template.Template][]TemplateTestCase
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

	for tmpl, cases := range setup.Templates {
		t.Run(tmpl.Name(), func(t *testing.T) {
			t.Parallel()

			tname := strings.TrimSuffix(tmpl.Name(), ".sql")
			for _, input := range cases {
				t.Run(input.Name, func(t *testing.T) {
					t.Parallel()

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
