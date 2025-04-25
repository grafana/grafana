{{/* this query is used to validate the keeper update or creation */}}

SELECT
  {{ .Ident "name" }}
FROM
  {{ .Ident "secret_keeper" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }} AND
  {{ .Ident "name" }} IN ({{ .ArgList .KeeperNames }})
{{ .SelectFor "UPDATE" }}
;
