DELETE FROM {{ .Ident "secret_encrypted_value" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }}      = {{ .Arg .UID }}
;
