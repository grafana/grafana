{{/* this query is used to validate the keeper update or creation */}}

SELECT
  {{ .Ident "guid" }},
  {{ .Ident "name" }},
  {{ .Ident "namespace" }},
  {{ .Ident "annotations" }},
  {{ .Ident "labels" }},
  {{ .Ident "created" }},
  {{ .Ident "created_by" }},
  {{ .Ident "updated" }},
  {{ .Ident "updated_by" }},
  {{ .Ident "title" }},
  {{ .Ident "type" }},
  {{ .Ident "payload" }}
FROM
  {{ .Ident "secret_keeper" }}
WHERE 1 = 1 AND
  {{ .Ident "namespace" }} =  {{ .Arg .Namespace }}       AND
  {{ .Ident "name" }}      IN {{ .ArgList .KeeperNames }} AND
  {{ .Ident "type" }}      != {{ .Arg .ExcludeKeeperType }}
{{ .SelectFor "UPDATE" }}
;
