SELECT
    "uid",
    "title",
    "folder",
    "subresource",
    "content",
    "metadata",
    "rank"
    FROM (
    SELECT DISTINCT ON ("uid")
        "uid",
        "title",
        COALESCE("folder", '') AS "folder",
        "subresource",
        "content",
        "metadata",
        ts_rank_cd(to_tsvector('english', "content"), websearch_to_tsquery('english', 'mimir "high latency" -staging')) AS "rank"
    FROM embeddings
    WHERE "resource"  = 'alertrules_external'
    AND "namespace" = 'stacks-123'
    AND "model"     = 'text-embedding-005'
    AND to_tsvector('english', "content") @@ websearch_to_tsquery('english', 'mimir "high latency" -staging')
    ORDER BY "uid", "rank" DESC
    ) AS best
    WHERE "rank" > 0
    ORDER BY "rank" DESC, "uid" ASC
    LIMIT 40
;
