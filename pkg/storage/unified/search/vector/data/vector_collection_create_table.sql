CREATE TABLE IF NOT EXISTS {{ .Table }} (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    subresource VARCHAR(256) NOT NULL DEFAULT '',
    folder VARCHAR(256),
    content TEXT NOT NULL,
    metadata JSONB,
    embedding halfvec(1024) NOT NULL,
    UNIQUE (name, subresource)
);

CREATE INDEX IF NOT EXISTS {{ .HNSWIndexName }}
    ON {{ .Table }} USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS {{ .MetadataIndexName }}
    ON {{ .Table }} USING GIN (metadata);
