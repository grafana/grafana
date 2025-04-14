DELETE FROM {{ .Ident "secret_keeper" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }}      = {{ .Arg .Name }}
;
