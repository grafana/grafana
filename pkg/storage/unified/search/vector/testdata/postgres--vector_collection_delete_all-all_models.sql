DELETE FROM embeddings
    WHERE ctid IN (
        SELECT ctid FROM embeddings
        WHERE "resource"  = 'dashboards'
        AND "namespace" = 'stacks-123'
        LIMIT 10000
    )
    AND "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
;
