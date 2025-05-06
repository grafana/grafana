SELECT
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "status_phase" }},
  {{ .Ident "status_message" }},
  {{ .Ident "description" }},
  {{ .Ident "keeper" }},
  {{ .Ident "decrypters" }},
  {{ .Ident "ref" }},
  {{ .Ident "external_id" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
{{ if .IsForUpdate }}
{{ .SelectFor "UPDATE" }}
{{ end }}
;
