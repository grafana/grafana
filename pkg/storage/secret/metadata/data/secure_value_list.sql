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
  {{ .Ident "active" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "active" }} = true
ORDER BY {{ .Ident "updated" }} DESC
;