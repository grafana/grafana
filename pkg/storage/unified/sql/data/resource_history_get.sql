SELECT
  {{ .Ident "guid" }},
  {{ .Ident "resource_version" }},
  {{ .Ident "namespace" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
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
  {{ if .SortAscending }}
  AND {{ .Ident "resource_version" }} > {{ .Arg .StartRV }}
  {{ else }}
  AND {{ .Ident "resource_version" }} < {{ .Arg .StartRV }}
  {{ end }}
  {{ end }}
  {{ if (gt .MinRV 0) }}
  AND {{ .Ident "resource_version" }} >= {{ .Arg .MinRV }}
  {{ end }}
  {{ if (gt .ExactRV 0) }}
  AND {{ .Ident "resource_version" }} = {{ .Arg .ExactRV }}
  {{ end }}
{{ if .SortAscending }}
ORDER BY resource_version ASC
{{ else }}
ORDER BY resource_version DESC
{{ end }}
