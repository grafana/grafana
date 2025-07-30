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
  {{ .Ident "description" }},
  {{ .Ident "keeper" }},
  {{ .Ident "decrypters" }},
  {{ .Ident "ref" }},
  {{ .Ident "external_id" }},
  {{ .Ident "active" }},
  {{ .Ident "version" }},
  {{ .Ident "owner_reference_api_version" }},
  {{ .Ident "owner_reference_kind" }},
  {{ .Ident "owner_reference_name" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "active" }} = true
{{ if .IsForUpdate }}
{{ .SelectFor "UPDATE" }}
{{ end }}
;