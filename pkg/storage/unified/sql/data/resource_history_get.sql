SELECT
  {{ .Ident "resource_version" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "folder" }},
  {{ .Ident "value" }}
FROM {{ .Ident "resource_history" }}
WHERE 1 = 1
  AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
  AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
  AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
  {{ if .Key.Name }}
  AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}
  {{ end }}
  {{ if .Trash }}
  AND {{ .Ident "action" }} = 3
  {{ end }}
  {{ if (gt .StartRV 0) }}
  AND {{ .Ident "resource_version" }} < {{ .Arg .StartRV }}
  {{ end }}
ORDER BY resource_version DESC
