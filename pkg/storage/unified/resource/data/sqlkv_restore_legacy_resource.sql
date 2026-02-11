{{- if eq .DialectName "mysql" -}}
UPDATE {{ .Ident "resource" }} r
JOIN (
    SELECT {{ .Ident "guid" }}, {{ .Ident "value" }}, {{ .Ident "resource_version" }},
           {{ .Ident "action" }}, {{ .Ident "folder" }}, {{ .Ident "previous_resource_version" }}
    FROM {{ .Ident "resource_history" }}
    WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
      AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
      AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND {{ .Ident "name" }} = {{ .Arg .Name }}
    ORDER BY {{ .Ident "resource_version" }} DESC
    LIMIT 1
) h ON 1=1
SET r.{{ .Ident "guid" }} = h.{{ .Ident "guid" }},
    r.{{ .Ident "value" }} = h.{{ .Ident "value" }},
    r.{{ .Ident "resource_version" }} = h.{{ .Ident "resource_version" }},
    r.{{ .Ident "action" }} = h.{{ .Ident "action" }},
    r.{{ .Ident "folder" }} = h.{{ .Ident "folder" }},
    r.{{ .Ident "previous_resource_version" }} = h.{{ .Ident "previous_resource_version" }}
WHERE r.{{ .Ident "group" }} = {{ .Arg .Group }}
  AND r.{{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND r.{{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND r.{{ .Ident "name" }} = {{ .Arg .Name }};
{{- else -}}
UPDATE {{ .Ident "resource" }}
SET {{ .Ident "guid" }} = h.{{ .Ident "guid" }},
    {{ .Ident "value" }} = h.{{ .Ident "value" }},
    {{ .Ident "resource_version" }} = h.{{ .Ident "resource_version" }},
    {{ .Ident "action" }} = h.{{ .Ident "action" }},
    {{ .Ident "folder" }} = h.{{ .Ident "folder" }},
    {{ .Ident "previous_resource_version" }} = h.{{ .Ident "previous_resource_version" }}
FROM (
    SELECT {{ .Ident "guid" }}, {{ .Ident "value" }}, {{ .Ident "resource_version" }},
           {{ .Ident "action" }}, {{ .Ident "folder" }}, {{ .Ident "previous_resource_version" }}
    FROM {{ .Ident "resource_history" }}
    WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
      AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
      AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND {{ .Ident "name" }} = {{ .Arg .Name }}
    ORDER BY {{ .Ident "resource_version" }} DESC
    LIMIT 1
) h
WHERE {{ .Ident "resource" }}.{{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }}.{{ .Ident "resource" }} = {{ .Arg .Resource }}
  AND {{ .Ident "resource" }}.{{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "resource" }}.{{ .Ident "name" }} = {{ .Arg .Name }};
{{- end }}
