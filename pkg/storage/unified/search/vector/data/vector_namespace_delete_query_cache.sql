DELETE FROM query_embedding_cache
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
