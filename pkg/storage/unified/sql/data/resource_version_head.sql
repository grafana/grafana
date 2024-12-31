 SELECT
    MIN({{ .Ident "rv" | .Into .Response.ResourceVersion }}) AS rv,
    {{ .CurrentEpoch | .Into .Response.CurrentEpoch }} AS current_epoch
    FROM (
        SELECT MAX({{ .Ident "resource_version" }}) AS rv
        FROM {{ .Ident "resource_history" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        UNION ALL
        SELECT MIN({{ .Ident "resource_version" }}) AS rv
        FROM {{ .Ident "resource_lock" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        UNION ALL
        SELECT {{ .CurrentEpoch }} AS rv
    ) AS t
    WHERE rv IS NOT NULL
;