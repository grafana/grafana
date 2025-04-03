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
  {{ .Ident "name" }} = {{ .Arg .Name }} AND
  {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
ORDER BY {{ .Ident "updated" }} DESC
;
