DELETE FROM {{ .Ident .TokenTable }} WHERE {{ .Ident "id" }} = {{ .Arg .TokenID }};
