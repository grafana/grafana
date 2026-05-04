-- +goose Up
-- Stores the shard index assigned to each namespace (tenant).
CREATE TABLE IF NOT EXISTS shard_assignments (
    namespace VARCHAR(255) PRIMARY KEY,
    shard_index INT NOT NULL,
    created_at BIGINT NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS shard_assignments;
