CREATE TABLE IF NOT EXISTS vec_42 (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    subresource VARCHAR(256) NOT NULL DEFAULT '',
    folder VARCHAR(256),
    content TEXT NOT NULL,
    metadata JSONB,
    embedding halfvec(1024) NOT NULL,
    UNIQUE (name, subresource)
);
CREATE INDEX IF NOT EXISTS vec_42_hnsw
    ON vec_42 USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS vec_42_metadata
    ON vec_42 USING GIN (metadata);
