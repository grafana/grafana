SELECT
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }}
    FROM {{ .Table }}
    WHERE {{ .Ident "name" }} = {{ .Arg .Name }}
;
