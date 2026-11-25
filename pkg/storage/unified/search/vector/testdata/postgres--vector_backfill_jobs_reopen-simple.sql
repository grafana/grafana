UPDATE vector_backfill_jobs
    SET "is_complete"     = FALSE,
        "content_version" = 2,
        "stopping_rv"      = 12345,
        "last_seen_key"    = NULL,
        "last_error"       = NULL,
        "updated_at"       = CURRENT_TIMESTAMP
    WHERE "model" = 'text-embedding-005'
      AND (
          "resource" = 'dashboards'
          OR ("resource" = '' AND NOT EXISTS (
              SELECT 1 FROM embedding_collections WHERE partition_key = 'dashboards' AND scope = 'cluster'
          ))
      )
      AND "content_version" < 2
;
