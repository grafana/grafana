SELECT
    {{ .Ident "resource_version" | .Into .ResourceVersion }},
    {{ .Ident "namespace" | .Into .Key.Namespace }},
    {{ .Ident "group" | .Into .Key.Group }},
    {{ .Ident "resource" | .Into .Key.Resource }},
    {{ .Ident "name" | .Into .Key.Name }},
    {{ .Ident "value" | .Into .Value }},
    {{ .Ident "action" | .Into .Action }}

    FROM {{ .Ident "resource_history" }}
    WHERE {{ .Ident "resource_version" }} > {{ .Arg .SinceResourceVersion }}
;