SELECT
  {{ .Ident "uid" }},
  {{ .Ident "namespace" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
FROM
  {{ .Ident "secret_encrypted_value" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }} = {{ .Arg .UID }}
;
