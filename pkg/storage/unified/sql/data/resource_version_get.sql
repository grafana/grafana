SELECT
        {{ .Ident "resource_version" | .Into .ResourceVersion }}
    FROM {{ .Ident "resource_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}         = {{ .Arg .Key.Group }}
        AND {{ .Ident "resource" }}      = {{ .Arg .Key.Resource }}
;
