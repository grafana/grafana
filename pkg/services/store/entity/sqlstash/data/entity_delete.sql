DELETE FROM {{ .Ident "entity" }}
    WHERE 1 = 1
        AND {{ .Ident "namespace" }} = {{ .Arg .Key.Namespace }}
        AND {{ .Ident "group" }}     = {{ .Arg .Key.Group }}
        AND {{ .Ident "resource" }}  = {{ .Arg .Key.Resource }}
        AND {{ .Ident "name" }}      = {{ .Arg .Key.Name }}
;
