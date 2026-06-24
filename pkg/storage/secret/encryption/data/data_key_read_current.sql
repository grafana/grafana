SELECT
  {{ .Ident "uid" }},
  {{ .Ident "namespace" }},
  {{ .Ident "label" }},
  {{ .Ident "provider" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "active" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
FROM
  {{ .Ident "secret_data_key" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "label" }} = {{ .Arg .Label }} AND
  {{ .Ident "active" }} = true
;
