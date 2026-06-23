SELECT
    {{ .Ident "subresource" | .Into .Response.Subresource }},
    {{ .Ident "content" | .Into .Response.Content }},
    {{ .Ident "folder" | .Into .Response.Folder }}
    FROM embeddings
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "uid" }}       = {{ .Arg .UID }}
;
