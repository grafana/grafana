CREATE TABLE IF NOT EXISTS resource_embeddings_stacks_123
    PARTITION OF "resource_embeddings"
    FOR VALUES IN ('stacks-123')
    PARTITION BY LIST (model);
CREATE TABLE IF NOT EXISTS resource_embeddings_stacks_123__text_embedding_005
    PARTITION OF resource_embeddings_stacks_123
    FOR VALUES IN ('text-embedding-005');
