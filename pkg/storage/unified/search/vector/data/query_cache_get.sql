SELECT {{ .Ident "embedding" | .Into .Response.Embedding }}
    FROM query_embedding_cache
    WHERE {{ .Ident "namespace" }}  = {{ .Arg .Namespace }}
      AND {{ .Ident "model" }}      = {{ .Arg .Model }}
      AND {{ .Ident "query_hash" }} = {{ .Arg .QueryHash }}
;
