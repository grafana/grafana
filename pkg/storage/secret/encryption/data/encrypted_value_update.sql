UPDATE
  {{ .Ident "secret_encrypted_value" }}
SET
  {{ .Ident "encrypted_data" }} = {{ .Arg .EncryptedData }},
  {{ .Ident "updated" }} = {{ .Arg .Updated }}
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "version" }} = {{ .Arg .Version }}
;
