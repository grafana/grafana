-- +goose Up
-- Enable btree_gin extension to support composite GIN indexes with B-tree types (e.g. namespace + tags).
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- +goose Down
DROP EXTENSION IF EXISTS btree_gin;
