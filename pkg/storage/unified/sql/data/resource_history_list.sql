SELECT
    kv.{{ .Ident "resource_version" | .Into .Response.ResourceVersion }},
    {{ .Ident "value" | .Into .Response.Value }}
    FROM {{ .Ident "resource_history" }} as kv 
    JOIN (
        SELECT {{ .Ident "guid" }}, max({{ .Ident "resource_version" }}) AS {{ .Ident "resource_version" }}
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
    ON maxkv.{{ .Ident "guid" }}  = kv.{{ .Ident "guid" }} 
    WHERE kv.{{ .Ident "action" }}  != 3 
    ORDER BY kv.{{ .Ident "resource_version" }} ASC
    {{ if (gt .Request.Limit 0) }}
    LIMIT {{ .Arg .Request.Offset }}, {{ .Arg .Request.Limit }}
    {{ end }}
;
