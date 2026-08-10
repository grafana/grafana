INSERT INTO vector_backfill_jobs
    ("model", "resource", "stopping_rv", "is_complete")
    VALUES ('text-embedding-005', 'dashboards', 12345, FALSE)
    ON CONFLICT ("model", "resource") DO NOTHING
;
