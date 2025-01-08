DELETE FROM {{ .Ident "resource_lock" }}
    WHERE 1 = 1
    AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
    AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
    AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }};