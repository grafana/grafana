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

//go:generate go run gen.go

//go:embed *.json */*.json
var devDashboardFS embed.FS

//go:embed tmpl/*.tmpl
var tmplFS embed.FS

func main() {
	g := newGen()
	out, err := g.Generate()
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

func (g *libjsonnetGen) Generate() (string, error) {
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
		if strings.HasPrefix(f.Name(), "jsonnetfile") || strings.HasPrefix(f.Name(), "panel-library") {
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
