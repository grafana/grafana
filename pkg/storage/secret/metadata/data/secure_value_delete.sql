DELETE FROM 
  {{ .Ident "secret_secure_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "version" }} = {{ .Arg .Version }}
;