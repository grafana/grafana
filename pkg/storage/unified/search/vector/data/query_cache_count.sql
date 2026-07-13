SELECT {{ .Into .Response.Count "COUNT(*)" }}
    FROM query_embedding_cache
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
