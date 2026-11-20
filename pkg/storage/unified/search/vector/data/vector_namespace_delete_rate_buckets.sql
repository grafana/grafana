DELETE FROM vector_search_rate_buckets
    WHERE {{ .Ident "namespace" }} = {{ .Arg .Namespace }}
;
