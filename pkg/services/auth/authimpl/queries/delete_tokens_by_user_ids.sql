DELETE FROM {{ .Ident .TokenTable }} WHERE {{ .Ident "user_id" }} IN ({{ range $i, $id := .UserIDs }}{{ if $i }}, {{ end }}{{ $.Arg $id }}{{ end }});
