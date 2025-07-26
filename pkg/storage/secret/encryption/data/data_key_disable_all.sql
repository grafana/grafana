UPDATE
  {{ .Ident "secret_data_key" }}
SET
  {{ .Ident "active" }} = false,
  {{ .Ident "updated" }} = {{ .Arg .Updated }}
WHERE {{ .Ident "active" }} = true
;
