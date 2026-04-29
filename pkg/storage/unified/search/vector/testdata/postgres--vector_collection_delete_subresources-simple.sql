DELETE FROM embeddings
    WHERE "resource"    = 'dashboards'
    AND "namespace"   = 'stacks-123'
    AND "model"       = 'text-embedding-005'
    AND "uid"         = 'abc-uid'
    AND "subresource" IN ('panel/1', 'panel/2')
;
