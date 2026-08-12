DELETE FROM query_embedding_cache
    WHERE ({{ .Ident "namespace" }}, {{ .Ident "model" }}, {{ .Ident "query_hash" }}) IN (
        SELECT {{ .Ident "namespace" }}, {{ .Ident "model" }}, {{ .Ident "query_hash" }}
            FROM query_embedding_cache
            WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
            ORDER BY {{ .Ident "created_at" }} ASC
            LIMIT {{ .Arg .Limit }}
    )
;
