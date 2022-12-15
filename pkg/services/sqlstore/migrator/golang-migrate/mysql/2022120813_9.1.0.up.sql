-- Add last_used_at to api_key table
alter table `api_key` ADD COLUMN `last_used_at` DATETIME NULL
-- add rule_group_idx column to alert_rule
alter table `alert_rule` ADD COLUMN `rule_group_idx` INT NOT NULL DEFAULT 1
-- add rule_group_idx column to alert_rule_version
alter table `alert_rule_version` ADD COLUMN `rule_group_idx` INT NOT NULL DEFAULT 1
-- create correlation table v1
CREATE TABLE IF NOT EXISTS `correlation` ( `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `source_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `target_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `label` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `description` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , PRIMARY KEY ( `uid`,`source_uid` )) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- drop index UQE_dashboard_public_config_uid - v1
DROP INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config`
-- drop index IDX_dashboard_public_config_org_id_dashboard_uid - v1
DROP INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config`
-- Drop old dashboard public config table
DROP TABLE IF EXISTS `dashboard_public_config`
-- recreate dashboard public config v1
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL , `dashboard_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `time_settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `refresh_rate` INT NOT NULL DEFAULT 30 , `template_variables` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- drop index UQE_dashboard_public_config_uid - v2
DROP INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config`
-- drop index IDX_dashboard_public_config_org_id_dashboard_uid - v2
DROP INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config`
-- Drop public config table
DROP TABLE IF EXISTS `dashboard_public_config`
-- Recreate dashboard public config v2
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL , `dashboard_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `time_settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `template_variables` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `access_token` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created_by` INT NOT NULL , `updated_by` INT NULL , `created_at` DATETIME NOT NULL , `updated_at` DATETIME NULL , `is_enabled` TINYINT(1) NOT NULL DEFAULT 0 ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_dashboard_public_config_uid - v2
CREATE UNIQUE INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config` (`uid`);
-- create index IDX_dashboard_public_config_org_id_dashboard_uid - v2
CREATE INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config` (`org_id`,`dashboard_uid`);
-- create index UQE_dashboard_public_config_access_token - v2
CREATE UNIQUE INDEX `UQE_dashboard_public_config_access_token` ON `dashboard_public_config` (`access_token`);
-- Rename table dashboard_public_config to dashboard_public - v2
ALTER TABLE `dashboard_public_config` RENAME TO `dashboard_public`
-- Add UID column to playlist
alter table `playlist` ADD COLUMN `uid` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 0
-- Update uid column values in playlist
UPDATE playlist SET uid=id;
-- Add index for uid in playlist
CREATE UNIQUE INDEX `UQE_playlist_org_id_uid` ON `playlist` (`org_id`,`uid`);
