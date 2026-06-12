SELECT
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "active" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "active" }} = TRUE
LIMIT 1
;