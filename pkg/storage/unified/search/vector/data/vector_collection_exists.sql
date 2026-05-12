SELECT {{ .Into .Response.Exists "1" }}
    FROM embeddings
    WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
    AND {{ .Ident "uid" }}       = {{ .Arg .UID }}
    LIMIT 1
;
