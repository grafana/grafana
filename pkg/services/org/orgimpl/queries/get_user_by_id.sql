SELECT *
FROM {{ .Ident .UserTable }}
WHERE id = {{ .Arg .UserID }}
  AND is_service_account = {{ .Arg .IsServiceAccount }}
