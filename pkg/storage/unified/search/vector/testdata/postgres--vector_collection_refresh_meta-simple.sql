UPDATE embeddings AS e
    SET "title"      = v.title,
        "folder"     = v.folder,
        "metadata"   = v.metadata::jsonb,
        "updated_at" = CURRENT_TIMESTAMP
    FROM (VALUES
        ('chunk/1', 'Thing One', 'folder-uid', '{"embeddedAt":1750000000}'),
        ('chunk/2', 'Thing Two', 'folder-uid', '{"embeddedAt":1750000000}')
    ) AS v(subresource, title, folder, metadata)
    WHERE e."resource"  = 'things_external'
    AND e."namespace" = 'stacks-123'
    AND e."model"     = 'text-embedding-005'
    AND e."uid"       = 'abc-uid'
    AND e."subresource" = v.subresource
;
