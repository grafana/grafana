UPDATE
  {{ .Ident "secret_data_key" }}
SET
  {{ .Ident "active" }} = false,
  {{ .Ident "updated" }} = {{ .Arg .Updated }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "active" }} = true
;
