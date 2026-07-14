UPDATE vector_backfill_jobs
    SET {{ .Ident "is_complete" }} = TRUE,
        {{ .Ident "updated_at" }}  = CURRENT_TIMESTAMP
    WHERE {{ .Ident "id" }} = {{ .Arg .ID }}
;
