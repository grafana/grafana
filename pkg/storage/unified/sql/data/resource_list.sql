SELECT
    {{ .Ident "resource_version" | .Into .Response.ResourceVersion }},
    {{ .Ident "value" | .Into .Response.Value }}
    FROM {{ .Ident "resource" }}
    WHERE 1 = 1
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
    ORDER BY {{ .Ident "resource_version" }} DESC
    {{ if (gt .Request.Limit 0) }}
    LIMIT {{ .Arg .Request.Limit }}
    {{ end }}
;
