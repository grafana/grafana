UPDATE {{ .Ident "resource_version" }}
    SET
        {{ .Ident "rv" }} = {{ .Arg .ResourceVersion }} + 1,

    WHERE 1 = 1
        AND {{ .Ident "group" }}    = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
        AND {{ .Ident "rv" }}       = {{ .Arg .ResourceVersion }}
;
