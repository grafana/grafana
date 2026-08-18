SELECT *
FROM {{ .Ident .UserTable }}
WHERE is_service_account = FALSE
  AND {{ .Ident .IdentifierColumn }} = {{ .Arg .Identifier }}
