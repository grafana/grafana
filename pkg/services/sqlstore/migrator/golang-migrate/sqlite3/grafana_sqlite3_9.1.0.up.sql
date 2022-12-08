-- Add last_used_at to api_key table
ALTER TABLE `api_key` ADD COLUMN `last_used_at` DATETIME NULL
-- add rule_group_idx column to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `rule_group_idx` INTEGER NOT NULL DEFAULT 1
-- add rule_group_idx column to alert_rule_version
ALTER TABLE `alert_rule_version` ADD COLUMN `rule_group_idx` INTEGER NOT NULL DEFAULT 1
-- create correlation table v1
CREATE TABLE IF NOT EXISTS `correlation` ( `uid` TEXT NOT NULL , `source_uid` TEXT NOT NULL , `target_uid` TEXT NULL , `label` TEXT NOT NULL , `description` TEXT NOT NULL , PRIMARY KEY ( `uid`,`source_uid` ));
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` TEXT PRIMARY KEY NOT NULL , `dashboard_uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `time_settings` TEXT NOT NULL , `refresh_rate` INTEGER NOT NULL DEFAULT 30 , `template_variables` TEXT NULL );
-- drop index UQE_dashboard_public_config_uid - v1
DROP INDEX `UQE_dashboard_public_config_uid`
-- drop index IDX_dashboard_public_config_org_id_dashboard_uid - v1
DROP INDEX `IDX_dashboard_public_config_org_id_dashboard_uid`
-- Drop old dashboard public config table
DROP TABLE IF EXISTS `dashboard_public_config`
-- recreate dashboard public config v1
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` TEXT PRIMARY KEY NOT NULL , `dashboard_uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `time_settings` TEXT NOT NULL , `refresh_rate` INTEGER NOT NULL DEFAULT 30 , `template_variables` TEXT NULL );
-- drop index UQE_dashboard_public_config_uid - v2
DROP INDEX `UQE_dashboard_public_config_uid`
-- drop index IDX_dashboard_public_config_org_id_dashboard_uid - v2
DROP INDEX `IDX_dashboard_public_config_org_id_dashboard_uid`
-- Drop public config table
DROP TABLE IF EXISTS `dashboard_public_config`
-- Recreate dashboard public config v2
CREATE TABLE IF NOT EXISTS `dashboard_public_config` ( `uid` TEXT PRIMARY KEY NOT NULL , `dashboard_uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `time_settings` TEXT NULL , `template_variables` TEXT NULL , `access_token` TEXT NOT NULL , `created_by` INTEGER NOT NULL , `updated_by` INTEGER NULL , `created_at` DATETIME NOT NULL , `updated_at` DATETIME NULL , `is_enabled` INTEGER NOT NULL DEFAULT 0 );
-- create index UQE_dashboard_public_config_uid - v2
CREATE UNIQUE INDEX `UQE_dashboard_public_config_uid` ON `dashboard_public_config` (`uid`);
-- create index IDX_dashboard_public_config_org_id_dashboard_uid - v2
CREATE INDEX `IDX_dashboard_public_config_org_id_dashboard_uid` ON `dashboard_public_config` (`org_id`,`dashboard_uid`);
-- create index UQE_dashboard_public_config_access_token - v2
CREATE UNIQUE INDEX `UQE_dashboard_public_config_access_token` ON `dashboard_public_config` (`access_token`);
-- Rename table dashboard_public_config to dashboard_public - v2
ALTER TABLE `dashboard_public_config` RENAME TO `dashboard_public`
-- Add UID column to playlist
ALTER TABLE `playlist` ADD COLUMN `uid` TEXT NOT NULL DEFAULT 0
-- Update uid column values in playlist
UPDATE playlist SET uid=printf('%d',id);
-- Add index for uid in playlist
CREATE UNIQUE INDEX `UQE_playlist_org_id_uid` ON `playlist` (`org_id`,`uid`);
