UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "status_message" }} = {{ .Arg .Message }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
;
