-- +goose Up
-- Tracks a live row count per namespace so the cleanup loop can enforce a
-- max-annotations-per-namespace cap without scanning every partition.
CREATE TABLE IF NOT EXISTS annotation_namespace_counts (
  namespace TEXT PRIMARY KEY,
  count BIGINT NOT NULL DEFAULT 0
);

-- +goose Down
DROP TABLE IF EXISTS annotation_namespace_counts;
