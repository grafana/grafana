-- +goose Up
-- Point annotations now default time_end to time on write. Backfill rows
-- written before that default was added.
UPDATE annotations SET time_end = time WHERE time_end IS NULL;

-- +goose Down
-- No-op: there is no way to tell backfilled points (time_end == time) apart
-- from ranges whose end genuinely equals their start, so this cannot be undone.
