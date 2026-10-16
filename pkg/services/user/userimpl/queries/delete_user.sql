DELETE FROM {{ .Ident .UserTable }}
WHERE id = {{ .Arg .UserID }}
