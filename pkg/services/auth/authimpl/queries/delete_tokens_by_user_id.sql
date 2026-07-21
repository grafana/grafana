DELETE FROM {{ .Ident .TokenTable }} WHERE {{ .Ident "user_id" }} = {{ .Arg .UserID }};
