INSERT INTO {{ .Ident "resource_lock" }}
    (
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "namespace" }},
        {{ .Ident "name" }},
        {{ .Ident "resource_version" }}
    )
    SELECT {{ .Arg .Key.Group }}, {{ .Arg .Key.Resource }}, {{ .Arg .Key.Namespace }}, {{ .Arg .Key.Name }}, MAX(rv)
    FROM (
        SELECT {{ .CurrentEpoch }} AS rv
        UNION ALL
        SELECT MAX({{ .Ident "resource_version" }}) + 1 AS rv
        FROM {{ .Ident "resource_history" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
        UNION ALL
        SELECT MIN({{ .Ident "resource_version" }}) + 1 AS rv
        FROM {{ .Ident "resource_lock" }}
        WHERE {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
    ) AS t
;