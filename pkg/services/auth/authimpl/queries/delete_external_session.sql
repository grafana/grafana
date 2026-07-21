DELETE FROM {{ .Ident .ExternalSessionTable }} WHERE {{ .Ident "id" }} = {{ .Arg .ID }};
