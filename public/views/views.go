package views

import (
	"embed"
	"html/template"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/web"
)

var (
	//go:embed index-template.html
	indexTemplate []byte
	//go:embed error-template.html
	errorTemplate []byte

	fallback = map[string][]byte{
		"index": indexTemplate,
		"error": errorTemplate,
	}

	//go:embed *.html
	html embed.FS
)

type Dynamic struct {
	*template.Template
}

func Index() *template.Template {
	return parse("index")
}

func Error() *template.Template {
	return parse("error")
}

func parse(name string) *template.Template {
	src, err := html.ReadFile(name + "html")
	if err != nil {
		src = fallback[name]
	}

	t, err := template.New("index").Delims("[[", "]]").Parse(string(src))
	if err != nil {
		panic(err)
	}
	return t
}

type Static string

const (
	Swagger  Static = "swagger"
	OpenAPI3 Static = "openapi3"
)

func (s Static) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	web.SetContentType(w, web.TextHTML)

	data, err := html.Open(string(s))
	if err != nil {
		panic(err)
	}
	io.Copy(w, data)
}
