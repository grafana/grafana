INSERT INTO vector_backfill_jobs
    ("model", "resource", "stopping_rv", "is_complete", "content_version")
    VALUES ('text-embedding-005', 'dashboards', 12345, FALSE, 1)
    ON CONFLICT ("model", "resource") DO NOTHING
;
