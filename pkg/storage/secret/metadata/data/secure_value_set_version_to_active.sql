UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "active" }} = ({{ .Ident "version" }} = {{ .Arg .Version}})
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
;