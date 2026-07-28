DELETE FROM embeddings
    WHERE ctid IN (
        SELECT ctid FROM embeddings
        WHERE {{ .Ident "resource" }}  = {{ .Arg .Resource }}
        AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
        AND {{ .Ident "model" }}     = {{ .Arg .Model }}
        LIMIT {{ .Arg .Limit }}
    )
    AND {{ .Ident "resource" }}  = {{ .Arg .Resource }}
    AND {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
    AND {{ .Ident "model" }}     = {{ .Arg .Model }}
;
