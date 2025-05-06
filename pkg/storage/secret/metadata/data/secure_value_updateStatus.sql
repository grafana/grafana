UPDATE
  {{ .Ident "secret_secure_value" }}
SET
  {{ .Ident "status_phase" }} = {{ .Arg .Phase }}
WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} = {{ .Arg .Name }}
;
