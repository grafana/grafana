-- +goose Up
-- Lookup table enforcing uniqueness of (namespace, name) across partitions.
-- Maps each annotation to its time value for direct partition targeting.
CREATE TABLE IF NOT EXISTS annotation_keys (
  namespace VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  time BIGINT NOT NULL,
  PRIMARY KEY (namespace, name)
);

-- Index for efficient cleanup by time range
CREATE INDEX IF NOT EXISTS idx_annotation_keys_time ON annotation_keys (time);

-- +goose Down
DROP TABLE IF EXISTS annotation_keys;
