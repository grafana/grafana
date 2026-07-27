SELECT
    "uid",
    "title",
    "subresource",
    "content",
    "embedding" <=> '[0.1 0.2 0.3]' AS "score",
    "folder",
    "metadata"
    FROM embeddings
    WHERE "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
    AND "model"     = 'text-embedding-005'
    ORDER BY "embedding" <=> '[0.1 0.2 0.3]'
    LIMIT 10
;
