-- +goose Up
ALTER TABLE tuple ADD COLUMN condition_name VARCHAR(256);
ALTER TABLE tuple ADD COLUMN condition_context LONGBLOB;
ALTER TABLE changelog ADD COLUMN condition_name VARCHAR(256);
ALTER TABLE changelog ADD COLUMN condition_context LONGBLOB;

-- +goose Down
ALTER TABLE tuple DROP COLUMN condition_name;
ALTER TABLE tuple DROP COLUMN condition_context;
ALTER TABLE changelog DROP COLUMN condition_name;
ALTER TABLE changelog DROP COLUMN condition_context;
