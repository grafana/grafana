UPDATE embeddings SET {{ .Ident "folder" }} = {{ .Arg .Folder }},
    {{ .Ident "updated_at" }} = CURRENT_TIMESTAMP
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "uid" }}       = {{ .Arg .UID }}
;
