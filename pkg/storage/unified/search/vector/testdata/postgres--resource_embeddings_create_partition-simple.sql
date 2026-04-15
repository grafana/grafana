CREATE TABLE IF NOT EXISTS resource_embeddings_stacks_123
    PARTITION OF "resource_embeddings"
    FOR VALUES IN ('stacks-123')
;
