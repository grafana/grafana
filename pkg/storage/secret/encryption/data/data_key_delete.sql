DELETE FROM {{ .Ident "secret_data_key" }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }}      = {{ .Arg .UID }}
;
