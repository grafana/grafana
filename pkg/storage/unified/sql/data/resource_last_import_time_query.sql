SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "last_import_time" }}
FROM
  {{ .Ident "resource_last_import_time" }}
{{- if .FilterKeys }}
WHERE (
  {{- range $i, $key := .FilterKeys }}
  {{- if $i }} OR {{- end }}
  ({{ $.Ident "namespace" }} = {{ $.SQLTemplate.Arg $key.Namespace }} 
   AND {{ $.Ident "group" }} = {{ $.SQLTemplate.Arg $key.Group }} 
   AND {{ $.Ident "resource" }} = {{ $.SQLTemplate.Arg $key.Resource }})
  {{- end }}
)
{{- end }}
;
