package miniprofiler

import (
	"html/template"
	"io/ioutil"
	"strings"
)

var includePartialHtmlTmpl = parseInclude("include", "/include.partial.html")
var shareHtmlTmpl = parseInclude("share", "/share.html")

func parseInclude(name string, fname string) *template.Template {
	f, err := webFS.Open(fname)
	if err != nil {
		panic(err)
	}
	t, err := ioutil.ReadAll(f)
	if err != nil {
		panic(err)
	}
	f.Close()
	s := string(t)
	s = strings.Replace(s, "{", "{{.", -1)
	s = strings.Replace(s, "}", "}}", -1)
	return template.Must(template.New(name).Parse(s))
}
