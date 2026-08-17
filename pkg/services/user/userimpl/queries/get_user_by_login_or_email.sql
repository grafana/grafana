SELECT *
FROM {{ .Ident .UserTable }}
WHERE is_service_account = {{ .Arg .IsServiceAccount }}
  AND {{ if .ByEmail }}email{{ else }}login{{ end }} = {{ .Arg .Identifier }}
