SELECT {{ .TokenColumns }} FROM {{ .Ident .TokenTable }}
WHERE {{ .Ident "user_id" }} = {{ .Arg .UserID }} AND {{ .Ident "revoked_at" }} > {{ .Arg 0 }} ORDER BY {{ .Ident "seen_at" }} ASC;
