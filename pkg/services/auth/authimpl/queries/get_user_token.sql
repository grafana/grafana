SELECT {{ .TokenColumns }} FROM {{ .Ident .TokenTable }}
WHERE {{ .Ident "id" }} = {{ .Arg .TokenID }} AND {{ .Ident "user_id" }} = {{ .Arg .UserID }};
