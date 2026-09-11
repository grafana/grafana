UPDATE vector_backfill_jobs
    SET {{ .Ident "last_seen_key" }} = {{ .Arg .LastSeenKey }},
        {{ .Ident "last_error" }}    = {{ .Arg .LastError }},
        {{ .Ident "updated_at" }}    = CURRENT_TIMESTAMP
    WHERE {{ .Ident "id" }} = {{ .Arg .ID }}
;
