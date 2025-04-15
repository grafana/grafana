UPDATE
  {{ .Ident "secret_encrypted_value" }}
SET
  {{ .Ident "encrypted_data" }} = {{ .Arg .EncryptedData }},
  {{ .Ident "update" }} = {{ .Arg .Updated }},
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }} = {{ .Arg .UID }}
;
