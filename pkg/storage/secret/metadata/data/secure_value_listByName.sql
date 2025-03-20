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
  {{ .Ident "title" }},
  {{ .Ident "keeper" }},
  {{ .Ident "decrypters" }},
  {{ .Ident "ref" }},
  {{ .Ident "external_id" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 1 = 1 AND
  {{ .Ident "name" }} IN {{ .ArgList .UsedSecureValues }} AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
{{ .SelectFor "UPDATE" }}
;
