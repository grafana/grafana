DELETE FROM vector_search_rate_buckets
    WHERE {{ .Ident "window_start" }} < {{ .Arg .Cutoff }}
;
