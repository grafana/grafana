SELECT
        {{ .Ident "resource_version" | .Into .ResourceVersion }},
        {{ .Ident "created_at" | .Into .ResourceVersion }},
        {{ .Ident "updated_at" | .Into .ResourceVersion }}

    FROM {{ .Ident "kind_version" }}
    WHERE 1 = 1
        AND {{ .Ident "group" }}         = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}      = {{ .Arg .Resource }}
;
