SELECT
    "id",
    "model",
    "resource",
    "stopping_rv",
    "last_seen_key",
    "is_complete",
    "last_error"
    FROM vector_backfill_jobs
    WHERE "is_complete" = FALSE
      AND "model" = 'text-embedding-005'
    ORDER BY "id"
;
