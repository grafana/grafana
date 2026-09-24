-- +goose Up
UPDATE annotations SET time_end = time WHERE time_end IS NULL;

-- +goose Down
UPDATE annotations SET time_end = NULL WHERE time_end = time;
