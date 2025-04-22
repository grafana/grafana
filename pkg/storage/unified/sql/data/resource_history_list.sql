SELECT
    kv.{{ .Ident "guid" }},
    kv.{{ .Ident "resource_version" }},
    kv.{{ .Ident "namespace" }},
    kv.{{ .Ident "group" }},
    kv.{{ .Ident "resource" }},
    kv.{{ .Ident "name" }},
    kv.{{ .Ident "folder" }},
    kv.{{ .Ident "value" }}
    FROM {{ .Ident "resource_history" }} as kv
    INNER JOIN  (
        SELECT {{ .Ident "namespace" }}, {{ .Ident "group" }}, {{ .Ident "resource" }}, {{ .Ident "name" }},  max({{ .Ident "resource_version" }}) AS {{ .Ident "resource_version" }}
        FROM {{ .Ident "resource_history" }} AS mkv
        WHERE 1 = 1
            AND {{ .Ident "resource_version" }} <=  {{ .Arg .Request.ResourceVersion }}
            {{ if and .Request.Options .Request.Options.Key }}
                {{ if .Request.Options.Key.Namespace }}
                AND {{ .Ident "namespace" }} = {{ .Arg .Request.Options.Key.Namespace }}
                {{ end }}
                {{ if .Request.Options.Key.Group }}
                AND {{ .Ident "group" }}     = {{ .Arg .Request.Options.Key.Group }}
                {{ end }}
                {{ if .Request.Options.Key.Resource }}
                AND {{ .Ident "resource" }}  = {{ .Arg .Request.Options.Key.Resource }}
                {{ end }}
                {{ if .Request.Options.Key.Name }}
                AND {{ .Ident "name" }}      = {{ .Arg .Request.Options.Key.Name }}
                {{ end }}
            {{ end }}
        GROUP BY mkv.{{ .Ident "namespace" }}, mkv.{{ .Ident "group" }}, mkv.{{ .Ident "resource" }}, mkv.{{ .Ident "name" }}
    ) AS maxkv
    ON
        maxkv.{{ .Ident "resource_version" }}  = kv.{{ .Ident "resource_version" }}
        AND maxkv.{{ .Ident "namespace" }}     = kv.{{ .Ident "namespace" }}
        AND maxkv.{{ .Ident "group" }}         = kv.{{ .Ident "group" }}
        AND maxkv.{{ .Ident "resource" }}      = kv.{{ .Ident "resource" }}
        AND maxkv.{{ .Ident "name" }}          = kv.{{ .Ident "name" }}
    WHERE kv.{{ .Ident "action" }}  != 3
    {{ if and .Request.Options .Request.Options.Key }}
        {{ if .Request.Options.Key.Namespace }}
        AND kv.{{ .Ident "namespace" }} = {{ .Arg .Request.Options.Key.Namespace }}
        {{ end }}
        {{ if .Request.Options.Key.Group }}
        AND kv.{{ .Ident "group" }}     = {{ .Arg .Request.Options.Key.Group }}
        {{ end }}
        {{ if .Request.Options.Key.Resource }}
        AND kv.{{ .Ident "resource" }}  = {{ .Arg .Request.Options.Key.Resource }}
        {{ end }}
        {{ if .Request.Options.Key.Name }}
        AND kv.{{ .Ident "name" }}      = {{ .Arg .Request.Options.Key.Name }}
        {{ end }}
    {{ end }}
    ORDER BY kv.{{ .Ident "namespace" }} ASC, kv.{{ .Ident "name" }} ASC
    {{ if (gt .Request.Limit 0) }}
    LIMIT {{ .Arg .Request.Limit }} OFFSET {{ .Arg .Request.Offset }}
    {{ end }}
;
