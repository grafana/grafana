UPDATE {{ .Ident "kind_version" }}
    SET {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }} + 1
    WHERE 1 = 1
        AND {{ .Ident "group" }}            = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}         = {{ .Arg .Resource }}
        AND {{ .Ident "resource_version" }} = {{ .Arg .ResourceVersion }}
;
