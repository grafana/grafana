SELECT COUNT(1) > 0
FROM {{ .Ident "secret_secure_value" }}
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "keeper" }} = {{ .Arg .Name }}
LIMIT 1