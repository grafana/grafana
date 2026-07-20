INSERT INTO query_embedding_cache (
    "namespace",
    "model",
    "query_hash",
    "embedding"
)
VALUES (
    'stacks-123',
    'text-embedding-005',
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    '[0.1,0.2,0.3]'
)
ON CONFLICT ("namespace", "model", "query_hash") DO NOTHING
;
