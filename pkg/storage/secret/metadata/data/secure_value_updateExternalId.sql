UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "external_id" }} = {{ .Arg .ExternalID }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "version" }} = {{ .Arg .Version }}
;