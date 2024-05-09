package sqltemplatetest

import (
	"errors"
	"testing"
	"text/template"
)

var errTest = errors.New("yes, it failed")

func TestGolden(t *testing.T) {
	t.Parallel()

	sqlTmpl := template.Must(template.New("sql").Parse(`
		UPDATE users SET value = ?;
	`))
	const expectedQuery = `UPDATE users SET value = ?;`

	t.Run("happy path", func(t *testing.T) {
		t.Parallel()

		err := Golden(sqlTmpl, expectedQuery, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		sqlTmpl := template.Must(template.New("sql").Parse(`
			{{ .this .is .a .valid .template .that .will .fail .execution }}
		`))

		err := Golden(sqlTmpl, expectedQuery, 1)
		if !errors.Is(err, ErrExecuteTemplate) {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("error executing template", func(t *testing.T) {
		t.Parallel()

		err := Golden(sqlTmpl, `unexpected query`, nil)
		if !errors.Is(err, ErrUnexpectedQuery) {
			t.Fatalf("unexpected error: %v", err)
		}
	})
}
