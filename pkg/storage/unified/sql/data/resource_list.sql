SELECT
    {{ .Ident "guid" }},
    {{ .Ident "resource_version" }},
    {{ .Ident "namespace" }},
    {{ .Ident "group" }},
    {{ .Ident "resource" }},
    {{ .Ident "name" }},
    {{ .Ident "folder" }},
    {{ .Ident "value" }}
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
    ORDER BY {{ .Ident "resource_version" }} ASC
;
