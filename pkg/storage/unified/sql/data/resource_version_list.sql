SELECT
    {{ .Ident "resource_version" | .Into .ResourceVersion }},
    {{ .Ident "group" | .Into .Group }},
    {{ .Ident "resource" | .Into .Resource }}
    FROM {{ .Ident "resource_version" }}
;
