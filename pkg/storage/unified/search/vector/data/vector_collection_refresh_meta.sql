UPDATE embeddings
    SET {{ .Ident "title" }}      = {{ .Arg .Title }},
        {{ .Ident "metadata" }}   = {{ .Arg .Metadata }},
        {{ .Ident "updated_at" }} = CURRENT_TIMESTAMP
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "uid" }}       = {{ .Arg .UID }}
    AND {{ .Ident "subresource" }} = {{ .Arg .Subresource }}
;
