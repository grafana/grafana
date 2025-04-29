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
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
