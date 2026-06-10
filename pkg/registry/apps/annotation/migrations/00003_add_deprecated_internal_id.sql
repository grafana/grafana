-- +goose Up
ALTER TABLE annotations ADD COLUMN deprecated_internal_id BIGINT;
CREATE INDEX idx_deprecated_internal_id ON annotations (namespace, deprecated_internal_id)
  WHERE deprecated_internal_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_deprecated_internal_id;
ALTER TABLE annotations DROP COLUMN IF EXISTS deprecated_internal_id;
