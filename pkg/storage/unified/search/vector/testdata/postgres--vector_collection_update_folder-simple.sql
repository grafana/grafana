UPDATE embeddings SET "folder" = 'folder-b',
    "updated_at" = CURRENT_TIMESTAMP
    WHERE "resource"  = 'dashboards'
    AND "namespace" = 'stacks-123'
    AND "model"     = 'text-embedding-005'
    AND "uid"       = 'abc-uid'
;
