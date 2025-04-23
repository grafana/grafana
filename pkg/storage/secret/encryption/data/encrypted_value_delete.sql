DELETE FROM {{ .Ident "secret_encrypted_value" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }}      = {{ .Arg .UID }}
;
