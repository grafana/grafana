INSERT INTO {{ .Ident "secret_keeper" }} (
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "description" }},
  {{ .Ident "type" }},
  {{ .Ident "payload" }}
)
SELECT
  {{ .Arg .Row.GUID }},
  {{ .Arg .Row.Name }},
  {{ .Arg .Row.Namespace }},
  {{ .Arg .Row.Annotations }},
  {{ .Arg .Row.Labels }},
  {{ .Arg .Row.Created }},
  {{ .Arg .Row.CreatedBy }},
  {{ .Arg .Row.Updated }},
  {{ .Arg .Row.UpdatedBy }},
  {{ .Arg .Row.Description }},
  {{ .Arg .Row.Type }},
  {{ .Arg .Row.Payload }}
FROM
  (SELECT 1) AS {{ .Ident "keeper_insert_check" }}
WHERE
{{- if .UsedSecureValues }}
  (
    SELECT COUNT(*) FROM (
      SELECT 1 FROM {{ .Ident "secret_secure_value" }}
      WHERE {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }}
        AND {{ .Ident "name" }} IN ({{ .ArgList .UsedSecureValues }})
        AND {{ .Ident "active" }} = true
        AND {{ .Ident "keeper" }} = {{ .Arg .SystemKeeperName }}
      {{ .SelectFor "UPDATE" }}
    ) AS {{ .Ident "sv_check" }}
  ) = {{ .Arg (len .UsedSecureValues) }}
{{- else }}
  1 = 1
{{- end }}
;
