SELECT *
FROM {{ .Ident .UserTable }}
WHERE id = {{ .Arg .UserID }}
{{ if .ExcludeServiceAccounts -}}
  AND is_service_account = FALSE
{{ end -}}
