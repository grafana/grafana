UPDATE {{ .Ident "secret_keeper" }}
SET {{ .Ident "active" }} = ({{ .Ident "name" }} = {{ .Arg .Name }})
WHERE 
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
