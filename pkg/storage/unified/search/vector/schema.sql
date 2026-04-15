CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS resource_embeddings (
    id                BIGSERIAL,
    namespace         VARCHAR(256) NOT NULL,
    "group"           VARCHAR(256) NOT NULL,
    resource          VARCHAR(256) NOT NULL,
    name              VARCHAR(256) NOT NULL,
    subresource       VARCHAR(256) NOT NULL DEFAULT '',
    resource_version  BIGINT NOT NULL,
    folder            VARCHAR(256),
    content           TEXT NOT NULL,
    metadata          JSONB,
    embedding         halfvec(768) NOT NULL,
    model             VARCHAR(256) NOT NULL,
    PRIMARY KEY (namespace, id),
    UNIQUE (namespace, "group", resource, name, subresource)
) PARTITION BY LIST (namespace);

CREATE INDEX IF NOT EXISTS resource_embeddings_hnsw_idx
    ON resource_embeddings USING hnsw (embedding halfvec_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS resource_embeddings_metadata_idx
    ON resource_embeddings USING GIN (metadata);
