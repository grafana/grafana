SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "version" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
FROM
  {{ .Ident "secret_encrypted_value" }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "version" }} = {{ .Arg .Version }}
;
