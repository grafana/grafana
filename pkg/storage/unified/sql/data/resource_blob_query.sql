SELECT
  {{ .Ident "uuid" }},
  {{ .Ident "value" }},
  {{ .Ident "content_type" }}
FROM {{ .Ident "resource_blob" }}
WHERE 1 = 1
  AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
  AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
  AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
  {{ if .Key.Name }}
  AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}
  {{ end }}
  {{ if .UID }}
  AND {{ .Ident "uuid" }}      = {{ .Arg .UID }}
  {{ end }}
ORDER BY {{ .Ident "created" }} DESC
LIMIT 1;
