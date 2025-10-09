SELECT
  {{ .Ident "namespace" }},
  {{ .Ident "group" }},
  {{ .Ident "resource" }},
  {{ .Ident "last_import_time" }}
FROM
  {{ .Ident "resource_last_import_time" }}
;
