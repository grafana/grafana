-- +goose Up
ALTER TABLE authorization_model ADD COLUMN schema_version VARCHAR(5) NOT NULL DEFAULT '1.0';

-- +goose Down
ALTER TABLE authorization_model DROP COLUMN schema_version;
