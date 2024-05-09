package sqltemplate

import (
	"testing"
	"text/template"
)

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
