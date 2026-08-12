-- +goose Up
ALTER TABLE annotations ADD COLUMN legacy_data TEXT;

-- +goose Down
ALTER TABLE annotations DROP COLUMN IF EXISTS legacy_data;
