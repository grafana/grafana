SELECT
    {{ .Ident "resource_version" | .Into .Response.ResourceVersion }},
    {{ .Ident "namespace" | .Into .Response.Key.Namespace }},
    {{ .Ident "group" | .Into .Response.Key.Group }},
    {{ .Ident "resource" | .Into .Response.Key.Resource }},
    {{ .Ident "name" | .Into .Response.Key.Name }},
    {{ .Ident "value" | .Into .Response.Value }},
    {{ .Ident "action" | .Into .Response.Action }}

    FROM {{ .Ident "resource_history" }}
    WHERE 1 = 1
    AND {{ .Ident "group" }} = {{ .Arg .Group }}
    AND {{ .Ident "resource" }} = {{ .Arg .Resource }}
    AND {{ .Ident "resource_version" }} > {{ .Arg .SinceResourceVersion }}
    ORDER BY {{ .Ident "resource_version" }} ASC
;
