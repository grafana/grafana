DELETE FROM {{ .Ident .ExternalSessionTable }} WHERE {{ .Ident "user_id" }} IN ({{ range $i, $id := .UserIDs }}{{ if $i }}, {{ end }}{{ $.Arg $id }}{{ end }});
