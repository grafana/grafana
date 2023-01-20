//go:generate go run gen.go
package main

import (
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/template"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

const (
	tmplPath = "rbac/tmpl"
)

func main() {
	var t string
	flag.StringVar(&t, "type", "permissions_backend", "")
	flag.Parse()

	funcMap := template.FuncMap{
		"Action": func(s string) string { return "Action" + s },
		"Title":  func(s string) string { return cases.Title(language.Und).String(s) },
		"ScopeDocs": func(r Resource, v Verb) string {
			if v.Unscoped {
				return "n/a"
			}
			var scopes []string
			if !v.ParentOnlyScope {
				scopes = append(
					scopes,
					fmt.Sprintf("`%s:*`", r.Name),
					fmt.Sprintf("`%s:%s:*`", r.Name, r.Attribute),
				)
			}

			if r.Parent != "" {
				scopes = append(
					scopes,
					fmt.Sprintf("`%s:*`", r.Parent),
					fmt.Sprintf("`%s:%s:*`", r.Parent, r.ParentAttribute),
				)
			}

			return strings.Join(scopes, "<br>")
		},
	}

	tmpl, err := template.New("tmpl.tmpl").Funcs(funcMap).ParseFiles(
		"rbac/tmpl/permissions_docs.tmpl",
		"rbac/tmpl/permissions_backend.tmpl",
		"rbac/tmpl/permissions_frontend.tmpl",
	)
	if err != nil {
		panic(err)
	}

	sort.Slice(registry, func(i, j int) bool {
		return registry[i].Name < registry[j].Name
	})

	for _, r := range registry {
		sort.Slice(r.SubResources, func(i, j int) bool {
			return r.SubResources[i].Name < r.SubResources[j].Name
		})
	}

	if err := tmpl.ExecuteTemplate(os.Stdout, t+".tmpl", registry); err != nil {
		panic(err)
	}
}
