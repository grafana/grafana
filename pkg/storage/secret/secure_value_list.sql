SELECT "uid", 
  "namespace", "name", "title",
  "manager", "path",
  "encrypted_kid", "encrypted_salt", "encrypted_value", 
  "created", "created_by",
  "updated", "updated_by",
  "annotations", "labels", 
  "apis"
FROM {{ .Ident "secure_value" }}
WHERE 1 = 1
{{ if .Request.Namespace }}
  AND "namespace" = {{ .Arg .Request.Namespace }}
{{ end }}
{{ if .Request.Name }}
  AND "name" = {{ .Arg .Request.Name }}
{{ end }}
{{ if .Request.UID }}
  AND "uid" = {{ .Arg .Request.UID }}
{{ end }}
ORDER BY {{ .Ident "updated" }} DESC