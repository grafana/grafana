-- Add isPublic for dashboard
alter table `dashboard` ADD COLUMN `is_public` TINYINT(1) NOT NULL DEFAULT 0
-- add current_reason column related to current_state
alter table `alert_instance` ADD COLUMN `current_reason` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- create alert_image table
CREATE TABLE IF NOT EXISTS `alert_image` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `token` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `path` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `url` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created_at` DATETIME NOT NULL , `expires_at` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index on token to alert_image table
CREATE UNIQUE INDEX `UQE_alert_image_token` ON `alert_image` (`token`);
-- create secrets table
CREATE TABLE IF NOT EXISTS `secrets` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `namespace` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `value` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- rename data_keys name column to id
ALTER TABLE `data_keys` CHANGE `name` `id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
-- add name column into data_keys
alter table `data_keys` ADD COLUMN `name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''
-- copy data_keys id column values into name
UPDATE data_keys SET name = id
-- rename data_keys name column to label
ALTER TABLE `data_keys` CHANGE `name` `label` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
-- rename data_keys id column back to name
ALTER TABLE `data_keys` CHANGE `id` `name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
-- add column org_id in query_history_star
alter table `query_history_star` ADD COLUMN `org_id` BIGINT(20) NOT NULL DEFAULT 1
-- create entity_events table
CREATE TABLE IF NOT EXISTS `entity_event` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `entity_id` VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `event_type` VARCHAR(8) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create dashboard public config v1
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` BIGINT(20) PRIMARY KEY NOT NULL , `dashboard_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `refresh_rate` INT NOT NULL DEFAULT 30 , `template_variables` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `time_variables` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_dashboard_public_config_uid - v1
CREATE UNIQUE INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config` (`uid`);
-- create index IDX_dashboard_public_config_org_id_dashboard_uid - v1
CREATE INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config` (`org_id`,`dashboard_uid`);
-- create file table
CREATE TABLE IF NOT EXISTS `file` ( `path` VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `path_hash` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `parent_folder_path_hash` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `contents` BLOB NOT NULL , `etag` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `cache_control` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `content_disposition` VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `updated` DATETIME NOT NULL , `created` DATETIME NOT NULL , `size` BIGINT(20) NOT NULL , `mime_type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- file table idx: path natural pk
CREATE UNIQUE INDEX `UQE_file_path_hash` ON `file` (`path_hash`);
-- file table idx: parent_folder_path_hash fast folder retrieval
CREATE INDEX `IDX_file_parent_folder_path_hash` ON `file` (`parent_folder_path_hash`);
-- create file_meta table
CREATE TABLE IF NOT EXISTS `file_meta` ( `path_hash` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `key` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `value` VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- file table idx: path key
CREATE UNIQUE INDEX `UQE_file_meta_path_hash_key` ON `file_meta` (`path_hash`,`key`);
-- set path collation in file table
SELECT 0;
