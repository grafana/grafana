SELECT
    MIN({{ .Ident "resource_version" | .Into .Response.ResourceVersion }})
    FROM {{ .Ident "resource_lock" }}
    WHERE 1 = 1
    AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
    {{ if .Key.Namespace }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
    {{ end }}
;
