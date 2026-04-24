SELECT
    "name",
    "subresource",
    "content",
    "embedding" <=> '[0.1 0.2 0.3]' AS "score",
    "folder",
    "metadata"
    FROM dashboard_embeddings
    WHERE "namespace" = 'stacks-123'
    AND "model"       = 'text-embedding-005'
    AND "name" IN ('dash-1', 'dash-2')
    ORDER BY "embedding" <=> '[0.1 0.2 0.3]'
    LIMIT 10
;
