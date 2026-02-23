DELETE FROM {{ .Ident "secret_keeper" }}
WHERE  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }}      = {{ .Arg .Name }}
;
