DELETE FROM embeddings
    WHERE "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
    AND "uid"       IN ('u1', 'u2')
;
