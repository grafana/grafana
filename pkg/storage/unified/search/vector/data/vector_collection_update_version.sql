UPDATE embeddings SET {{ .Ident "content_version" }} = {{ .Arg .Version }}
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "uid" }}       = {{ .Arg .UID }}
;
