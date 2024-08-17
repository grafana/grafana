CREATE INDEX {{ if .Unique }} UNIQUE{{ end }} {{ .Ident .IndexName }}
    ON {{ .Ident .TableName }} (
    {{- range $i, $columnName := .ColumnNames }}
        {{- if ne $i 0 }},{{ end }}
        {{- $columnName }}
    {{- end -}}
)
