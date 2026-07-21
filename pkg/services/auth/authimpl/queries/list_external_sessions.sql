SELECT {{ .ExternalSessionColumns }} FROM {{ .Ident .ExternalSessionTable }}
{{ if or .ID .UserID .SessionIDHash .NameIDHash }}WHERE {{ end }}
{{- $and := false -}}
{{- if .ID }}{{ .Ident "id" }} = {{ .Arg .ID }}{{ $and = true }}{{ end -}}
{{- if .UserID }}{{ if $and }} AND {{ end }}{{ .Ident "user_id" }} = {{ .Arg .UserID }}{{ $and = true }}{{ end -}}
{{- if .SessionIDHash }}{{ if $and }} AND {{ end }}{{ .Ident "session_id_hash" }} = {{ .Arg .SessionIDHash }}{{ $and = true }}{{ end -}}
{{- if .NameIDHash }}{{ if $and }} AND {{ end }}{{ .Ident "name_id_hash" }} = {{ .Arg .NameIDHash }}{{ end }}
ORDER BY {{ .Ident "id" }} DESC;
