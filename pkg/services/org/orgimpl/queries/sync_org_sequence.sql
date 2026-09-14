{{ if eq .DialectName "postgres" -}}
SELECT setval({{ .Arg .OrgSequence }}::regclass, (SELECT max(id) FROM {{ .Ident .OrgTable }}));
{{ else -}}
SELECT 1
{{ end -}}
