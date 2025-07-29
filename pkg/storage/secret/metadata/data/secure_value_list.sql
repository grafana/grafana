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
  {{ .Ident "version" }},
  {{ .Ident "active" }},
  {{ .Ident "owner_reference_api_version" }},
  {{ .Ident "owner_reference_kind" }},
  {{ .Ident "owner_reference_name" }},
  {{ .Ident "owner_reference_uid" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "active" }} = true
ORDER BY {{ .Ident "updated" }} DESC
;