SELECT
  {{ .Ident "created" }},
  {{ .Ident "version" }},
  {{ .Ident "active" }},
  {{ .Ident "namespace" }},
  {{ .Ident "name" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
ORDER BY {{ .Ident "version" }} DESC
LIMIT 1
;