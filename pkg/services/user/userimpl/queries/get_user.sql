SELECT *
FROM {{ .Ident .UserTable }}
WHERE is_service_account = FALSE
  AND {{ if eq .IdentifierColumn "id" }}id{{ else if eq .IdentifierColumn "login" }}login{{ else if eq .IdentifierColumn "email" }}email{{ end }} = {{ .Arg .Identifier }}
