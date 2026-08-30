-- +goose Up
-- Convert created_at from epoch-millis BIGINT to a native TIMESTAMPTZ.
-- Existing values are milliseconds since the Unix epoch, so divide by 1000 to get
-- seconds before handing them to to_timestamp.
ALTER TABLE annotations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING to_timestamp(created_at / 1000.0);

-- +goose Down
-- Convert back to epoch-millis BIGINT.
ALTER TABLE annotations
  ALTER COLUMN created_at TYPE BIGINT USING (extract(epoch FROM created_at) * 1000)::BIGINT;
