DELETE FROM dashboard_embeddings
    WHERE "namespace" = 'stacks-123'
    AND "model"       = 'text-embedding-005'
    AND "name"        = 'abc-uid'
    AND "subresource" IN ('panel/1', 'panel/2')
;
