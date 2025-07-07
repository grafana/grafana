{{/* this query is used to validate the keeper update or creation */}}

SELECT
  {{ .Ident "name" }},
  {{ .Ident "keeper" }}
FROM
  {{ .Ident "secret_secure_value" }}
WHERE
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} IN ({{ .ArgList .UsedSecureValues }}) AND
  {{ .Ident "active" }} = true
{{ .SelectFor "UPDATE" }}
;
