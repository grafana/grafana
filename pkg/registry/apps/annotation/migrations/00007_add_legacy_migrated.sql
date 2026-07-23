-- +goose Up
ALTER TABLE annotations ADD COLUMN legacy_migrated BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_legacy_migrated ON annotations (namespace) WHERE legacy_migrated;

-- +goose Down
DROP INDEX IF EXISTS idx_legacy_migrated;
ALTER TABLE annotations DROP COLUMN IF EXISTS legacy_migrated;
