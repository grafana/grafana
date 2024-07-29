package sqltemplate

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"text/template"
)

func TestSQLTemplate(t *testing.T) {
	t.Parallel()

	field := reflect.ValueOf(new(struct {
		X int
	})).Elem().FieldByName("X")

	tmpl := New(MySQL)
	tmpl.Arg(1)
	_, err := tmpl.Into(field, "colname")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	tmpl.SetDialect(SQLite)
	a := tmpl.GetArgs()
	d := tmpl.GetScanDest()
	if len(a) != 0 || len(d) != 0 {
		t.Fatalf("unexpected values after SetDialect(). Args: %v, ScanDest: %v",
			a, d)
	}

	b, err := json.Marshal(tmpl)
	if b != nil || !errors.Is(err, ErrSQLTemplateNoSerialize) {
		t.Fatalf("should fail serialization with ErrSQLTemplateNoSerialize")
	}

	err = json.Unmarshal([]byte(`{}`), &tmpl)
	if !errors.Is(err, ErrSQLTemplateNoSerialize) {
		t.Fatalf("should fail deserialization with ErrSQLTemplateNoSerialize")
	}

	err = tmpl.Validate()
	if !errors.Is(err, ErrValidationNotImplemented) {
		t.Fatalf("should fail with ErrValidationNotImplemented")
	}
}

func TestExecute(t *testing.T) {
	t.Parallel()

	tmpl := template.Must(template.New("test").Parse(`{{ .ID }}`))

	data := struct {
		ID int
	}{
		ID: 1,
	}

	txt, err := Execute(tmpl, data)
	if txt != "1" || err != nil {
		t.Fatalf("unexpected error, txt: %q, err: %v", txt, err)
	}

	txt, err = Execute(tmpl, 1)
	if txt != "" || err == nil {
		t.Fatalf("unexpected result, txt: %q, err: %v", txt, err)
	}
}

func TestFormatSQL(t *testing.T) {
	t.Parallel()

	// TODO: improve testing

	const (
		input = `
			SELECT *
				FROM "mytab" AS t
				WHERE "id">= 3 AND   "str" = ?  ;
		`
		expected = `SELECT *
    FROM "mytab" AS t
    WHERE "id" >= 3 AND "str" = ?;`
	)

	got := FormatSQL(input)
	if expected != got {
		t.Fatalf("Unexpected output.\n\tExpected: %s\n\tActual: %s", expected,
			got)
	}
}
