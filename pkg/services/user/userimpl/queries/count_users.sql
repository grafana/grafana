SELECT COUNT(*) AS count
FROM {{ .Ident .UserTable }}
WHERE is_service_account = FALSE
