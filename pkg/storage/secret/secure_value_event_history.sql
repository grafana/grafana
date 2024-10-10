SELECT "ts", "action", "identity", "details"
FROM {{ .Ident "secure_value_history" }}
WHERE "namespace" = {{ .Arg .Namespace }}
  AND "name" = {{ .Arg .Name }}
LIMIT 101