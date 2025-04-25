DELETE FROM {{ .Ident "secret_secure_value" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }}      = {{ .Arg .Name }}
;
