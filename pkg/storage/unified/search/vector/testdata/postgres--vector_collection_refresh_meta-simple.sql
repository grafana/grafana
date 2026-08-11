UPDATE embeddings AS e
    SET "title"      = v.title,
        "metadata"   = v.metadata::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
    FROM (VALUES
        ('chunk/1', 'Thing One', '[123 34 101 109 98 101 100 100 101 100 65 116 34 58 49 55 53 48 48 48 48 48 48 48 125]'),
        ('chunk/2', 'Thing Two', '[123 34 101 109 98 101 100 100 101 100 65 116 34 58 49 55 53 48 48 48 48 48 48 48 125]')
    ) AS v(subresource, title, metadata)
    WHERE e."resource"  = 'things_external'
    AND e."namespace" = 'stacks-123'
    AND e."model"     = 'text-embedding-005'
    AND e."uid"       = 'abc-uid'
    AND e."subresource" = v.subresource
;
