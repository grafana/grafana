UPDATE embeddings
    SET "title"      = 'Thing One',
        "metadata"   = '[123 34 101 109 98 101 100 100 101 100 65 116 34 58 49 55 53 48 48 48 48 48 48 48 125]',
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "resource"  = 'things_external'
    AND "namespace" = 'stacks-123'
    AND "model"     = 'text-embedding-005'
    AND "uid"       = 'abc-uid'
    AND "subresource" = 'chunk/1'
;
