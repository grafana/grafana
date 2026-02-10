{{- if eq .DialectName "mysql" -}}
INSERT INTO {{ .Ident "resource" }}
(
  {{ .Ident "guid" }},
  {{ .Ident "value" }},
  {{ .Ident "resource_version" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "action" }},
  {{ .Ident "folder" }},
  {{ .Ident "previous_resource_version" }}
)
SELECT
  h.{{ .Ident "guid" }},
  h.{{ .Ident "value" }},
  h.{{ .Ident "resource_version" }},
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  h.{{ .Ident "action" }},
  h.{{ .Ident "folder" }},
  h.{{ .Ident "previous_resource_version" }}
FROM (
    SELECT
      {{ .Ident "guid" }},
      {{ .Ident "value" }},
      {{ .Ident "resource_version" }},
      {{ .Ident "action" }},
      {{ .Ident "folder" }},
      {{ .Ident "previous_resource_version" }}
    FROM {{ .Ident "resource_history" }}
    WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
      AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
      AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND {{ .Ident "name" }} = {{ .Arg .Name }}
    ORDER BY {{ .Ident "resource_version" }} DESC
    LIMIT 1
) h
WHERE h.{{ .Ident "action" }} != 3
ON DUPLICATE KEY UPDATE
  {{ .Ident "guid" }} = VALUES({{ .Ident "guid" }}),
  {{ .Ident "value" }} = VALUES({{ .Ident "value" }}),
  {{ .Ident "resource_version" }} = VALUES({{ .Ident "resource_version" }}),
  {{ .Ident "action" }} = VALUES({{ .Ident "action" }}),
  {{ .Ident "folder" }} = VALUES({{ .Ident "folder" }}),
  {{ .Ident "previous_resource_version" }} = VALUES({{ .Ident "previous_resource_version" }});
{{- else -}}
INSERT INTO {{ .Ident "resource" }}
(
  {{ .Ident "guid" }},
  {{ .Ident "value" }},
  {{ .Ident "resource_version" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "action" }},
  {{ .Ident "folder" }},
  {{ .Ident "previous_resource_version" }}
)
SELECT
  h.{{ .Ident "guid" }},
  h.{{ .Ident "value" }},
  h.{{ .Ident "resource_version" }},
  {{ .Arg .Group }},
  {{ .Arg .Resource }},
  {{ .Arg .Namespace }},
  {{ .Arg .Name }},
  h.{{ .Ident "action" }},
  h.{{ .Ident "folder" }},
  h.{{ .Ident "previous_resource_version" }}
FROM (
    SELECT
      {{ .Ident "guid" }},
      {{ .Ident "value" }},
      {{ .Ident "resource_version" }},
      {{ .Ident "action" }},
      {{ .Ident "folder" }},
      {{ .Ident "previous_resource_version" }}
    FROM {{ .Ident "resource_history" }}
    WHERE {{ .Ident "group" }} = {{ .Arg .Group }}
      AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
      AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
      AND {{ .Ident "name" }} = {{ .Arg .Name }}
    ORDER BY {{ .Ident "resource_version" }} DESC
    LIMIT 1
) h
WHERE h.{{ .Ident "action" }} != 3
ON CONFLICT (
  {{ .Ident "namespace" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "name" }}
)
DO UPDATE SET
  {{ .Ident "guid" }} = EXCLUDED.{{ .Ident "guid" }},
  {{ .Ident "value" }} = EXCLUDED.{{ .Ident "value" }},
  {{ .Ident "resource_version" }} = EXCLUDED.{{ .Ident "resource_version" }},
  {{ .Ident "action" }} = EXCLUDED.{{ .Ident "action" }},
  {{ .Ident "folder" }} = EXCLUDED.{{ .Ident "folder" }},
  {{ .Ident "previous_resource_version" }} = EXCLUDED.{{ .Ident "previous_resource_version" }};
{{- end }}
