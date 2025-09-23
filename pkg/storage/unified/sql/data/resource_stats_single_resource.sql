SELECT
  COUNT(*),
  COALESCE(MAX({{ .Ident "resource_version" }}), 0)
FROM {{ .Ident "resource" }}
WHERE 1 = 1
  AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
  AND {{ .Ident "group" }} = {{ .Arg .Group }}
  AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
;
