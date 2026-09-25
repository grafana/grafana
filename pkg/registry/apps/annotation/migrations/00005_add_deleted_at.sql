-- +goose Up
-- Add a deleted_at column to the annotations table to support soft-deletes.
ALTER TABLE annotations ADD COLUMN deleted_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE annotations DROP COLUMN IF EXISTS deleted_at;
