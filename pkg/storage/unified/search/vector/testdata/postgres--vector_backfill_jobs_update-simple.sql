UPDATE vector_backfill_jobs
    SET "last_seen_key" = '{tok-42 true}',
        "last_error"    = '{ false}',
        "updated_at"    = CURRENT_TIMESTAMP
    WHERE "id" = 7
;
