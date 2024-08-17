CREATE TABLE {{ .Ident .TableName }} (
    {{- range $i, $column := .Columns -}}
        {{- if ne $i 0 }}, {{ end -}}

        {{ $.Ident .ColName }} {{ .ColType }}

        {{- if .ColNotNull }} NOT NULL{{ else }} NULL{{ end -}}

        {{- if .ColHasDefault }} DEFAULT {{ $.Arg .ColDefault }}{{ end -}}
    {{- end -}}
)
