UPDATE vector_backfill_jobs
    SET "last_error" = '{boom true}',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = 7
;
