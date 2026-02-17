SELECT
  {{ .Ident "id" }},
  {{ .Ident "created" }},
  {{ .Ident "completed" }}
FROM
  {{ .Ident "secret_consolidation_history" }}
ORDER BY {{ .Ident "id" }} DESC
LIMIT 1
;
