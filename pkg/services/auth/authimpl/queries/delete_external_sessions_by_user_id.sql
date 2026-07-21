DELETE FROM {{ .Ident .ExternalSessionTable }} WHERE {{ .Ident "user_id" }} = {{ .Arg .UserID }};
