-- Add isPublic for dashboard
ALTER TABLE `dashboard` ADD COLUMN `is_public` INTEGER NOT NULL DEFAULT 0;
-- add current_reason column related to current_state
ALTER TABLE `alert_instance` ADD COLUMN `current_reason` TEXT NULL;
-- create alert_image table
CREATE TABLE IF NOT EXISTS `alert_image` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `token` TEXT NOT NULL , `path` TEXT NOT NULL , `url` TEXT NOT NULL , `created_at` DATETIME NOT NULL , `expires_at` DATETIME NOT NULL );
-- add unique index on token to alert_image table
CREATE UNIQUE INDEX `UQE_alert_image_token` ON `alert_image` (`token`);
-- create secrets table
CREATE TABLE IF NOT EXISTS `secrets` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `namespace` TEXT NOT NULL , `type` TEXT NOT NULL , `value` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- rename data_keys name column to id
ALTER TABLE `data_keys` RENAME COLUMN `name` TO `id`;
-- add name column into data_keys
ALTER TABLE `data_keys` ADD COLUMN `name` TEXT NOT NULL DEFAULT '';
-- copy data_keys id column values into name
UPDATE data_keys SET name = id;
-- rename data_keys name column to label
ALTER TABLE `data_keys` RENAME COLUMN `name` TO `label`;
-- rename data_keys id column back to name
ALTER TABLE `data_keys` RENAME COLUMN `id` TO `name`;
-- add column org_id in query_history_star
ALTER TABLE `query_history_star` ADD COLUMN `org_id` INTEGER NOT NULL DEFAULT 1;
-- create entity_events table
CREATE TABLE IF NOT EXISTS `entity_event` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `entity_id` TEXT NOT NULL , `event_type` TEXT NOT NULL , `created` INTEGER NOT NULL );
-- create dashboard public config v1
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` INTEGER PRIMARY KEY NOT NULL , `dashboard_uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `refresh_rate` INTEGER NOT NULL DEFAULT 30 , `template_variables` TEXT NULL , `time_variables` TEXT NOT NULL );
-- create index UQE_dashboard_public_config_uid - v1
CREATE UNIQUE INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config` (`uid`);
-- create index IDX_dashboard_public_config_org_id_dashboard_uid - v1
CREATE INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config` (`org_id`,`dashboard_uid`);
-- create file table
CREATE TABLE IF NOT EXISTS `file` ( `path` TEXT NOT NULL , `path_hash` TEXT NOT NULL , `parent_folder_path_hash` TEXT NOT NULL , `contents` BLOB NOT NULL , `etag` TEXT NOT NULL , `cache_control` TEXT NOT NULL , `content_disposition` TEXT NOT NULL , `updated` DATETIME NOT NULL , `created` DATETIME NOT NULL , `size` INTEGER NOT NULL , `mime_type` TEXT NOT NULL );
-- file table idx: path natural pk
CREATE UNIQUE INDEX `UQE_file_path_hash` ON `file` (`path_hash`);
-- file table idx: parent_folder_path_hash fast folder retrieval
CREATE INDEX `IDX_file_parent_folder_path_hash` ON `file` (`parent_folder_path_hash`);
-- create file_meta table
CREATE TABLE IF NOT EXISTS `file_meta` ( `path_hash` TEXT NOT NULL , `key` TEXT NOT NULL , `value` TEXT NOT NULL );
-- file table idx: path key
CREATE UNIQUE INDEX `UQE_file_meta_path_hash_key` ON `file_meta` (`path_hash`,`key`);
