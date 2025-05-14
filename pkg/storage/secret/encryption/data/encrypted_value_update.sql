UPDATE
  {{ .Ident "secret_encrypted_value" }}
SET
  {{ .Ident "encrypted_data" }} = {{ .Arg .EncryptedData }},
  {{ .Ident "updated" }} = {{ .Arg .Updated }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }} = {{ .Arg .UID }}
;
