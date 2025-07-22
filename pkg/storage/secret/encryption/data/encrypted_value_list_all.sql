SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "name" }},
  {{ .Ident "version" }},
  {{ .Ident "encrypted_data" }},
  {{ .Ident "created" }},
  {{ .Ident "updated" }}
FROM
  {{ .Ident "secret_encrypted_value" }}
ORDER BY {{ .Ident "name" }} ASC
{{ if (gt .Limit 0) }}
LIMIT {{ .Arg .Limit }} OFFSET {{ .Arg .Offset }}
{{ end }}
;
