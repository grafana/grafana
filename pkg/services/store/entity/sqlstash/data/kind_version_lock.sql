SELECT {{ .Ident "resource_version" | .Into .ResourceVersion }}
    FROM {{ .Ident "kind_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}    = {{ .Arg .Group }}
        AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    {{ .SelectFor "UPDATE" }}
;
