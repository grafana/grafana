UPDATE
  {{ .Ident "secret_data_key" }}
SET
  {{ .Ident "active" }} = false,
  {{ .Ident "updated" }} = {{ .Arg .Updated }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "active" }} = true
;
