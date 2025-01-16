-- +goose Up
ALTER TABLE tuple MODIFY COLUMN object_id varchar(256);

-- +goose Down
ALTER TABLE tuple MODIFY COLUMN object_id varchar(128);
