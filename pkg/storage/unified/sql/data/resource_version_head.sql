 SELECT
    MIN({{ .Ident "rv" | .Into .Response.ResourceVersion }}) AS rv
    FROM (
        SELECT MAX({{ .Ident "resource_version" }}) AS rv
        FROM {{ .Ident "resource_history" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        UNION ALL
        SELECT MIN({{ .Ident "resource_version" }}) - 1 AS rv
        FROM {{ .Ident "resource_lock" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    ) AS t
    WHERE rv IS NOT NULL
;