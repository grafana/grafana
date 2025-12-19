INSERT INTO {{ .Ident .TableName }}
(
  {{ .Ident "key_path" }},
  {{ .Ident "value" }}
)
VALUES (
  {{ .Arg .KeyPath }},
  COALESCE({{ .Arg .Value }}, "")
)
{{- if eq .DialectName "mysql" }}
ON DUPLICATE KEY UPDATE {{ .Ident "value" }} = {{ .Arg .Value }}
{{- else }}
ON CONFLICT ({{ .Ident "key_path" }}) DO UPDATE SET {{ .Ident "value" }} = {{ .Arg .Value }}
{{- end }}
;
