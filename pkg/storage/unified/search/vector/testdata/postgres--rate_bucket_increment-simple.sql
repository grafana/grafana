INSERT INTO vector_search_rate_buckets (
    "namespace",
    "window_start",
    "request_count"
)
VALUES (
    'stacks-123',
    '2026-05-20 12:00:00 +0000 UTC',
    1
)
ON CONFLICT ("namespace", "window_start")
DO UPDATE SET "request_count" = vector_search_rate_buckets."request_count" + 1
RETURNING "request_count"
;
