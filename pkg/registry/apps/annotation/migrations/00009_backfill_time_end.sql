-- +goose Up
UPDATE annotations SET time_end = time WHERE time_end IS NULL;

-- +goose Down
-- This migration is not safely reversible as it is not possible to know which rows had NULL time_end before the update.
-- Leaving time_end = time is acceptable since the annotations will still be interpreted as point annotations.
