DELETE FROM query_embedding_cache
    WHERE ("namespace", "model", "query_hash") IN (
        SELECT "namespace", "model", "query_hash"
            FROM query_embedding_cache
            WHERE "namespace" = 'stacks-123'
            ORDER BY "created_at" ASC
            LIMIT 5
    )
;
