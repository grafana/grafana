SELECT
    MIN({{ .Ident "resource_version" | .Into .ResourceVersion }}),
    {{ .Ident "group" | .Into .Group }},
    {{ .Ident "resource" | .Into .Resource }}
    FROM (
        SELECT MAX({{ .Ident "resource_version" }}) AS "resource_version", {{ .Ident "group" }}, {{ .Ident "resource" }}
        FROM {{ .Ident "resource_history" }}
        GROUP BY {{ .Ident "group" }}, {{ .Ident "resource" }}
        UNION ALL
        SELECT MIN({{ .Ident "resource_version" }}) - 1 AS "resource_version", {{ .Ident "group" }}, {{ .Ident "resource" }}
        FROM {{ .Ident "resource_lock" }}
        GROUP BY {{ .Ident "group" }}, {{ .Ident "resource" }}
    ) AS t
    GROUP BY {{ .Ident "group" }}, {{ .Ident "resource" }}
;
