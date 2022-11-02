//go:build ignore
// +build ignore

package main

import (
	"bytes"
	"embed"
	"os"
	"path"
	"strings"
	"text/template"
)

var EXCLUDE = map[string]struct{}{
	"jsonnetfile.json":      {},
	"jsonnetfile.lock.json": {},
	"panel-library.json":    {}, // TODO: remove panel-library once importing issue is fixed
}

//go:generate go run gen.go

//go:embed *.json */*.json
var devDashboardFS embed.FS

//go:embed tmpl/*.tmpl
var tmplFS embed.FS

func main() {
	g := newGen()
	out, err := g.generate()
	if err != nil {
		panic(err)
	}
	os.WriteFile("./gen.libsonnet", []byte(out), 0644)
}

type devDashboard struct {
	Name string
	Path string
}

type libjsonnetGen struct {
	templates  *template.Template
	dashboards []devDashboard
}

func newGen() *libjsonnetGen {
	tmpls := template.New("codegen")
	tmpls = template.Must(tmpls.ParseFS(tmplFS, "tmpl/*.tmpl"))
	return &libjsonnetGen{templates: tmpls}
}

func (g *libjsonnetGen) generate() (string, error) {
	if err := g.readDir("."); err != nil {
		return "", err
	}

	buf := new(bytes.Buffer)
	vars := struct {
		Dashboards []devDashboard
	}{g.dashboards}

	if err := g.templates.Lookup("gen.libsonnet.tmpl").Execute(buf, vars); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func (g *libjsonnetGen) readDir(dir string) error {
	files, err := devDashboardFS.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, f := range files {
		if _, skip := EXCLUDE[f.Name()]; skip {
			continue
		}

		if f.IsDir() {
			if err := g.readDir(path.Join(dir, f.Name())); err != nil {
				return err
			}
			continue
		}

		name := strings.TrimSuffix(f.Name(), ".json")
		if len(name) > 40 {
			name = name[:40]
		}

		g.dashboards = append(g.dashboards, devDashboard{
			Path: path.Join(dir, f.Name()),
			Name: name,
		})
	}
	return nil
}
