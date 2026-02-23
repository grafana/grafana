SELECT
    COALESCE(MAX({{ .Ident "resource_version" }}), 0) AS {{ .Ident "resource_version" | .Into .Response.ResourceVersion }}

    FROM {{ .Ident "resource_history" }}

    WHERE {{ .Ident "namespace" }}   = {{ .Arg .Request.Key.Namespace }}
        AND {{ .Ident "group" }}     = {{ .Arg .Request.Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Request.Key.Resource }}
        AND {{ .Ident "name" }}      = {{ .Arg .Request.Key.Name }}
        {{ if gt .Request.EventType 0 }}
            AND {{ .Ident "action" }} = {{ .Arg .Request.EventType }}
        {{ end }}
    LIMIT 1
;
