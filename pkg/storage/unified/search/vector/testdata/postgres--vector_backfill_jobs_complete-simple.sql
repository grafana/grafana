UPDATE vector_backfill_jobs
    SET "is_complete" = TRUE,
        "updated_at"  = CURRENT_TIMESTAMP
    WHERE "id" = 7
;
