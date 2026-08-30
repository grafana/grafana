DELETE FROM embeddings
    WHERE ctid IN (
        SELECT ctid FROM embeddings
        WHERE "resource"  = 'dashboards'
        AND "namespace" = 'stacks-123'
        AND "model" = 'text-embedding-005'
        LIMIT 10000
    )
    AND "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
    AND "model" = 'text-embedding-005'
;
