DELETE FROM {{ .Ident .TokenTable }} WHERE {{ .Ident "user_id" }} = {{ .Arg .UserID }} AND {{ .Ident "revoked_at" }} > {{ .Arg 0 }} AND {{ .Ident "revoked_at" }} <= {{ .Arg .RevokedBefore }};
