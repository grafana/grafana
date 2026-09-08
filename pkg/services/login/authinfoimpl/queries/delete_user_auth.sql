DELETE FROM {{ .Ident .UserAuthTable }}
WHERE user_id = {{ .Arg .UserID }}
