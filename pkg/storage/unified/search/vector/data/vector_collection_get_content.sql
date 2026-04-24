SELECT
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }}
    FROM {{ .Table }}
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}       = {{ .Arg .Model }}
    AND {{ .Ident "name" }}        = {{ .Arg .Name }}
;
