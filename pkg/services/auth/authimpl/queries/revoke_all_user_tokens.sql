DELETE FROM {{ .Ident .TokenTable }}
WHERE user_id = {{ .Arg .UserID }}
