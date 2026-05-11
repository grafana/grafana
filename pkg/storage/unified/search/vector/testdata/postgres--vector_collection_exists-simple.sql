SELECT 1
    FROM embeddings
    WHERE "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
    AND "model"     = 'text-embedding-005'
    AND "uid"       = 'abc-uid'
    LIMIT 1
;
