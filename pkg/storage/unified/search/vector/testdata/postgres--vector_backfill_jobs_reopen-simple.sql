UPDATE vector_backfill_jobs
    SET "is_complete"     = FALSE,
        "content_version" = 2,
        "stopping_rv"      = 12345,
        "last_seen_key"    = NULL,
        "last_error"       = NULL,
        "updated_at"       = CURRENT_TIMESTAMP
    WHERE "model" = 'text-embedding-005'
      AND "resource" IN ('dashboards', '')
      AND "content_version" < 2
;
