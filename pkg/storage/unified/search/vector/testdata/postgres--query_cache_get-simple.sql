SELECT "embedding"
    FROM query_embedding_cache
    WHERE "namespace"  = 'stacks-123'
      AND "model"      = 'text-embedding-005'
      AND "query_hash" = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
;
