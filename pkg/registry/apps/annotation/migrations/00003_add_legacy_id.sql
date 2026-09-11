-- +goose Up
ALTER TABLE annotations ADD COLUMN legacy_id BIGINT;
CREATE INDEX idx_legacy_id ON annotations (namespace, legacy_id)
  WHERE legacy_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_legacy_id;
ALTER TABLE annotations DROP COLUMN IF EXISTS legacy_id;
