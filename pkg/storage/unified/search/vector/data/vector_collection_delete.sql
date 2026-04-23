DELETE FROM {{ .Table }}
    WHERE {{ .Ident "name" }} = {{ .Arg .Name }}
;
