DELETE FROM {{ .Ident "secret_data_key" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "uid" }}      = {{ .Arg .UID }}
;
