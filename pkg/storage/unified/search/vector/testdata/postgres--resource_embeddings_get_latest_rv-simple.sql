SELECT
    COALESCE(MAX("resource_version"), 0) AS "resource_version"
    FROM "resource_embeddings"
    WHERE "namespace" = 'stacks-123'
    AND "model" = 'text-embedding-005'
;
