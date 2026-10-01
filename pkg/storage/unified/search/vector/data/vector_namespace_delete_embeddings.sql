DELETE FROM embeddings
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
