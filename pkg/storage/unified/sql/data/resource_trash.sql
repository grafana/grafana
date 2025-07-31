SELECT
  h.{{ .Ident "guid" }},
  h.{{ .Ident "resource_version" }},
  h.{{ .Ident "namespace" }},
  h.{{ .Ident "group" }},
  h.{{ .Ident "resource" }},
  h.{{ .Ident "name" }},
  h.{{ .Ident "folder" }},
  h.{{ .Ident "value" }}
FROM {{ .Ident "resource_history" }} h
INNER JOIN (
  SELECT {{ .Ident "name" }}, MAX({{ .Ident "resource_version" }}) as max_rv
  FROM {{ .Ident "resource_history" }}
  WHERE 1 = 1
    AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
    AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
    {{ if .Key.Name }}
    AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}
    {{ end }}
    AND {{ .Ident "action" }} = 3
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
  GROUP BY {{ .Ident "name" }}
) max_versions ON h.{{ .Ident "name" }} = max_versions.{{ .Ident "name" }} 
  AND h.{{ .Ident "resource_version" }} = max_versions.max_rv
WHERE 1 = 1
  AND h.{{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
  AND h.{{ .Ident "group" }}     = {{ .Arg .Key.Group }}
  AND h.{{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
  AND h.{{ .Ident "action" }} = 3
  AND NOT EXISTS (
    SELECT 1 FROM {{ .Ident "resource" }} r
    WHERE r.{{ .Ident "namespace" }} = h.{{ .Ident "namespace" }}
      AND r.{{ .Ident "group" }} = h.{{ .Ident "group" }}
      AND r.{{ .Ident "resource" }} = h.{{ .Ident "resource" }}
      AND r.{{ .Ident "name" }} = h.{{ .Ident "name" }}
  )
{{ if .SortAscending }}
ORDER BY h.{{ .Ident "resource_version" }} ASC
{{ else }}
ORDER BY h.{{ .Ident "resource_version" }} DESC
{{ end }}
