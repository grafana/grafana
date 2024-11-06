SELECT
    kv.{{ .Ident "resource_version" }},
    kv.{{ .Ident "namespace" }},
    kv.{{ .Ident "name" }},
    kv.{{ .Ident "value" }}
FROM (
    SELECT
        {{ .Ident "resource_version" }},
        {{ .Ident "namespace" }},
        {{ .Ident "group" }},
        {{ .Ident "resource" }},
        {{ .Ident "name" }},
        {{ .Ident "value" }},
        {{ .Ident "action" }},
        MAX({{ .Ident "resource_version" }}) OVER (
            PARTITION BY {{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }}
            ORDER BY {{ .Ident "resource_version" }}
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS max_resource_version
    FROM {{ .Ident "resource_history" }}
    WHERE 1 = 1
        AND {{ .Ident "resource_version" }} <= {{ .Arg .Request.ResourceVersion }}
        {{ if and .Request.Options .Request.Options.Key }}
            {{ if .Request.Options.Key.Namespace }}
            AND {{ .Ident "namespace" }} = {{ .Arg .Request.Options.Key.Namespace }}
            {{ end }}
            {{ if .Request.Options.Key.Group }}
            AND {{ .Ident "group" }} = {{ .Arg .Request.Options.Key.Group }}
            {{ end }}
            {{ if .Request.Options.Key.Resource }}
            AND {{ .Ident "resource" }} = {{ .Arg .Request.Options.Key.Resource }}
            {{ end }}
            {{ if .Request.Options.Key.Name }}
            AND {{ .Ident "name" }} = {{ .Arg .Request.Options.Key.Name }}
            {{ end }}
        {{ end }}
) AS kv
WHERE kv.{{ .Ident "resource_version" }} = kv.max_resource_version
    AND kv.{{ .Ident "action" }} != 3
ORDER BY kv.{{ .Ident "namespace" }} ASC, kv.{{ .Ident "name" }} ASC
{{ if (gt .Request.Limit 0) }}
LIMIT {{ .Arg .Request.Limit }} OFFSET {{ .Arg .Request.Offset }}
{{ end }}
;