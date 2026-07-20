UPDATE
  {{ .Ident "secret_keeper" }}
SET
  {{ .Ident "guid" }} = {{ .Arg .Row.GUID }},
  {{ .Ident "name" }} = {{ .Arg .Row.Name }},
  {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }},
  {{ .Ident "annotations" }} = {{ .Arg .Row.Annotations }},
  {{ .Ident "labels" }} = {{ .Arg .Row.Labels }},
  {{ .Ident "created" }} = {{ .Arg .Row.Created }},
  {{ .Ident "created_by" }} = {{ .Arg .Row.CreatedBy }},
  {{ .Ident "updated" }} = {{ .Arg .Row.Updated }},
  {{ .Ident "updated_by" }} = {{ .Arg .Row.UpdatedBy }},
  {{ .Ident "description" }} = {{ .Arg .Row.Description }},
  {{ .Ident "type" }} = {{ .Arg .Row.Type }},
  {{ .Ident "payload" }} = {{ .Arg .Row.Payload }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Row.Name }}
{{- if .UsedSecureValues }}
  AND (
    SELECT COUNT(*) FROM (
      SELECT 1 FROM {{ .Ident "secret_secure_value" }}
      WHERE {{ .Ident "namespace" }} = {{ .Arg .Row.Namespace }}
        AND {{ .Ident "name" }} IN ({{ .ArgList .UsedSecureValues }})
        AND {{ .Ident "active" }} = true
        AND {{ .Ident "keeper" }} = {{ .Arg .SystemKeeperName }}
      {{ .SelectFor "UPDATE" }}
    ) AS {{ .Ident "sv_check" }}
  ) = {{ .Arg (len .UsedSecureValues) }}
{{- end }}
;
