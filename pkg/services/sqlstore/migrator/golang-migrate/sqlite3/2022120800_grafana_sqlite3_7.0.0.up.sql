-- create migration_log table
CREATE TABLE IF NOT EXISTS `migration_log` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `migration_id` TEXT NOT NULL , `sql` TEXT NOT NULL , `success` INTEGER NOT NULL , `error` TEXT NOT NULL , `timestamp` DATETIME NOT NULL );
-- create user table
CREATE TABLE IF NOT EXISTS `user` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `login` TEXT NOT NULL , `email` TEXT NOT NULL , `name` TEXT NULL , `password` TEXT NULL , `salt` TEXT NULL , `rands` TEXT NULL , `company` TEXT NULL , `account_id` INTEGER NOT NULL , `is_admin` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add unique index user.login
CREATE UNIQUE INDEX `UQE_user_login` ON `user` (`login`);
-- add unique index user.email
CREATE UNIQUE INDEX `UQE_user_email` ON `user` (`email`);
-- drop index UQE_user_login - v1
DROP INDEX `UQE_user_login`;
-- drop index UQE_user_email - v1
DROP INDEX `UQE_user_email`;
-- Rename table user to user_v1 - v1
ALTER TABLE `user` RENAME TO `user_v1`;
-- create user table v2
CREATE TABLE IF NOT EXISTS `user` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `login` TEXT NOT NULL , `email` TEXT NOT NULL , `name` TEXT NULL , `password` TEXT NULL , `salt` TEXT NULL , `rands` TEXT NULL , `company` TEXT NULL , `org_id` INTEGER NOT NULL , `is_admin` INTEGER NOT NULL , `email_verified` INTEGER NULL , `theme` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index UQE_user_login - v2
CREATE UNIQUE INDEX `UQE_user_login` ON `user` (`login`);
-- create index UQE_user_email - v2
CREATE UNIQUE INDEX `UQE_user_email` ON `user` (`email`);
-- Drop old table user_v1
DROP TABLE IF EXISTS `user_v1`;
-- Add column help_flags1 to user table
alter table `user` ADD COLUMN `help_flags1` INTEGER NOT NULL DEFAULT 0;
-- Add last_seen_at column to user
alter table `user` ADD COLUMN `last_seen_at` DATETIME NULL;
-- Add is_disabled column to user
alter table `user` ADD COLUMN `is_disabled` INTEGER NOT NULL DEFAULT 0;
-- Add index user.login/user.email
CREATE INDEX `IDX_user_login_email` ON `user` (`login`,`email`);
-- create temp user table v1-7
CREATE TABLE IF NOT EXISTS `temp_user` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `version` INTEGER NOT NULL , `email` TEXT NOT NULL , `name` TEXT NULL , `role` TEXT NULL , `code` TEXT NOT NULL , `status` TEXT NOT NULL , `invited_by_user_id` INTEGER NULL , `email_sent` INTEGER NOT NULL , `email_sent_on` DATETIME NULL , `remote_addr` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index IDX_temp_user_email - v1-7
CREATE INDEX `IDX_temp_user_email` ON `temp_user` (`email`);
-- create index IDX_temp_user_org_id - v1-7
CREATE INDEX `IDX_temp_user_org_id` ON `temp_user` (`org_id`);
-- create index IDX_temp_user_code - v1-7
CREATE INDEX `IDX_temp_user_code` ON `temp_user` (`code`);
-- create index IDX_temp_user_status - v1-7
CREATE INDEX `IDX_temp_user_status` ON `temp_user` (`status`);
-- create star table
CREATE TABLE IF NOT EXISTS `star` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `user_id` INTEGER NOT NULL , `dashboard_id` INTEGER NOT NULL );
-- add unique index star.user_id_dashboard_id
CREATE UNIQUE INDEX `UQE_star_user_id_dashboard_id` ON `star` (`user_id`,`dashboard_id`);
-- create org table v1
CREATE TABLE IF NOT EXISTS `org` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `name` TEXT NOT NULL , `address1` TEXT NULL , `address2` TEXT NULL , `city` TEXT NULL , `state` TEXT NULL , `zip_code` TEXT NULL , `country` TEXT NULL , `billing_email` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index UQE_org_name - v1
CREATE UNIQUE INDEX `UQE_org_name` ON `org` (`name`);
-- create org_user table v1
CREATE TABLE IF NOT EXISTS `org_user` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `user_id` INTEGER NOT NULL , `role` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index IDX_org_user_org_id - v1
CREATE INDEX `IDX_org_user_org_id` ON `org_user` (`org_id`);
-- create index UQE_org_user_org_id_user_id - v1
CREATE UNIQUE INDEX `UQE_org_user_org_id_user_id` ON `org_user` (`org_id`,`user_id`);
-- Migrate all Read Only Viewers to Viewers
UPDATE org_user SET role = 'Viewer' WHERE role = 'Read Only Editor';
-- create dashboard table
CREATE TABLE IF NOT EXISTS `dashboard` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `slug` TEXT NOT NULL , `title` TEXT NOT NULL , `data` TEXT NOT NULL , `account_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index dashboard.account_id
CREATE INDEX `IDX_dashboard_account_id` ON `dashboard` (`account_id`);
-- add unique index dashboard_account_id_slug
CREATE UNIQUE INDEX `UQE_dashboard_account_id_slug` ON `dashboard` (`account_id`,`slug`);
-- create dashboard_tag table
CREATE TABLE IF NOT EXISTS `dashboard_tag` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `dashboard_id` INTEGER NOT NULL , `term` TEXT NOT NULL );
-- add unique index dashboard_tag.dasboard_id_term
CREATE UNIQUE INDEX `UQE_dashboard_tag_dashboard_id_term` ON `dashboard_tag` (`dashboard_id`,`term`);
-- drop index UQE_dashboard_tag_dashboard_id_term - v1
DROP INDEX `UQE_dashboard_tag_dashboard_id_term`;
-- Rename table dashboard to dashboard_v1 - v1
ALTER TABLE `dashboard` RENAME TO `dashboard_v1`;
-- create dashboard v2
CREATE TABLE IF NOT EXISTS `dashboard` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `slug` TEXT NOT NULL , `title` TEXT NOT NULL , `data` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index IDX_dashboard_org_id - v2
CREATE INDEX `IDX_dashboard_org_id` ON `dashboard` (`org_id`);
-- create index UQE_dashboard_org_id_slug - v2
CREATE UNIQUE INDEX `UQE_dashboard_org_id_slug` ON `dashboard` (`org_id`,`slug`);
-- drop table dashboard_v1
DROP TABLE IF EXISTS `dashboard_v1`;
-- Add column updated_by in dashboard - v2
alter table `dashboard` ADD COLUMN `updated_by` INTEGER NULL;
-- Add column created_by in dashboard - v2
alter table `dashboard` ADD COLUMN `created_by` INTEGER NULL;
-- Add column gnetId in dashboard
alter table `dashboard` ADD COLUMN `gnet_id` INTEGER NULL;
-- Add index for gnetId in dashboard
CREATE INDEX `IDX_dashboard_gnet_id` ON `dashboard` (`gnet_id`);
-- Add column plugin_id in dashboard
alter table `dashboard` ADD COLUMN `plugin_id` TEXT NULL;
-- Add index for plugin_id in dashboard
CREATE INDEX `IDX_dashboard_org_id_plugin_id` ON `dashboard` (`org_id`,`plugin_id`);
-- Add index for dashboard_id in dashboard_tag
CREATE INDEX `IDX_dashboard_tag_dashboard_id` ON `dashboard_tag` (`dashboard_id`);
-- Add column folder_id in dashboard
alter table `dashboard` ADD COLUMN `folder_id` INTEGER NOT NULL DEFAULT 0;
-- Add column isFolder in dashboard
alter table `dashboard` ADD COLUMN `is_folder` INTEGER NOT NULL DEFAULT 0;
-- Add column has_acl in dashboard
alter table `dashboard` ADD COLUMN `has_acl` INTEGER NOT NULL DEFAULT 0;
-- Add column uid in dashboard
alter table `dashboard` ADD COLUMN `uid` TEXT NULL;
-- Update uid column values in dashboard
UPDATE dashboard SET uid=printf('%09d',id) WHERE uid IS NULL;
-- Add unique index dashboard_org_id_uid
CREATE UNIQUE INDEX `UQE_dashboard_org_id_uid` ON `dashboard` (`org_id`,`uid`);
-- Remove unique index org_id_slug
DROP INDEX `UQE_dashboard_org_id_slug`;
-- Add unique index for dashboard_org_id_title_folder_id
CREATE UNIQUE INDEX `UQE_dashboard_org_id_folder_id_title` ON `dashboard` (`org_id`,`folder_id`,`title`);
-- create dashboard_provisioning
CREATE TABLE IF NOT EXISTS `dashboard_provisioning` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `dashboard_id` INTEGER NULL , `name` TEXT NOT NULL , `external_id` TEXT NOT NULL , `updated` DATETIME NOT NULL );
-- Rename table dashboard_provisioning to dashboard_provisioning_tmp_qwerty - v1
ALTER TABLE `dashboard_provisioning` RENAME TO `dashboard_provisioning_tmp_qwerty`;
-- create dashboard_provisioning v2
CREATE TABLE IF NOT EXISTS `dashboard_provisioning` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `dashboard_id` INTEGER NULL , `name` TEXT NOT NULL , `external_id` TEXT NOT NULL , `updated` INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_dashboard_provisioning_dashboard_id - v2
CREATE INDEX `IDX_dashboard_provisioning_dashboard_id` ON `dashboard_provisioning` (`dashboard_id`);
-- create index IDX_dashboard_provisioning_dashboard_id_name - v2
CREATE INDEX `IDX_dashboard_provisioning_dashboard_id_name` ON `dashboard_provisioning` (`dashboard_id`,`name`);
-- drop dashboard_provisioning_tmp_qwerty
DROP TABLE IF EXISTS `dashboard_provisioning_tmp_qwerty`;
-- Add check_sum column
alter table `dashboard_provisioning` ADD COLUMN `check_sum` TEXT NULL;
-- Add index for dashboard_title
CREATE INDEX `IDX_dashboard_title` ON `dashboard` (`title`);
-- create data_source table
CREATE TABLE IF NOT EXISTS `data_source` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `account_id` INTEGER NOT NULL , `version` INTEGER NOT NULL , `type` TEXT NOT NULL , `name` TEXT NOT NULL , `access` TEXT NOT NULL , `url` TEXT NOT NULL , `password` TEXT NULL , `user` TEXT NULL , `database` TEXT NULL , `basic_auth` INTEGER NOT NULL , `basic_auth_user` TEXT NULL , `basic_auth_password` TEXT NULL , `is_default` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index data_source.account_id
CREATE INDEX `IDX_data_source_account_id` ON `data_source` (`account_id`);
-- add unique index data_source.account_id_name
CREATE UNIQUE INDEX `UQE_data_source_account_id_name` ON `data_source` (`account_id`,`name`);
-- drop index IDX_data_source_account_id - v1
DROP INDEX `IDX_data_source_account_id`;
-- drop index UQE_data_source_account_id_name - v1
DROP INDEX `UQE_data_source_account_id_name`;
-- Rename table data_source to data_source_v1 - v1
ALTER TABLE `data_source` RENAME TO `data_source_v1`;
-- create data_source table v2
CREATE TABLE IF NOT EXISTS `data_source` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `version` INTEGER NOT NULL , `type` TEXT NOT NULL , `name` TEXT NOT NULL , `access` TEXT NOT NULL , `url` TEXT NOT NULL , `password` TEXT NULL , `user` TEXT NULL , `database` TEXT NULL , `basic_auth` INTEGER NOT NULL , `basic_auth_user` TEXT NULL , `basic_auth_password` TEXT NULL , `is_default` INTEGER NOT NULL , `json_data` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index IDX_data_source_org_id - v2
CREATE INDEX `IDX_data_source_org_id` ON `data_source` (`org_id`);
-- create index UQE_data_source_org_id_name - v2
CREATE UNIQUE INDEX `UQE_data_source_org_id_name` ON `data_source` (`org_id`,`name`);
-- Drop old table data_source_v1 #2
DROP TABLE IF EXISTS `data_source_v1`;
-- Add column with_credentials
alter table `data_source` ADD COLUMN `with_credentials` INTEGER NOT NULL DEFAULT 0;
-- Add secure json data column
alter table `data_source` ADD COLUMN `secure_json_data` TEXT NULL;
-- Update initial version to 1
UPDATE data_source SET version = 1 WHERE version = 0;
-- Add read_only data column
alter table `data_source` ADD COLUMN `read_only` INTEGER NULL;
-- Migrate logging ds to loki ds
UPDATE data_source SET type = 'loki' WHERE type = 'logging';
-- Update json_data with nulls
UPDATE data_source SET json_data = '{}' WHERE json_data is null;
-- Add uid column
alter table `data_source` ADD COLUMN `uid` TEXT NOT NULL DEFAULT 0;
-- Update uid value
UPDATE data_source SET uid=printf('%09d',id);
-- Add unique index datasource_org_id_uid
CREATE UNIQUE INDEX `UQE_data_source_org_id_uid` ON `data_source` (`org_id`,`uid`);
-- create api_key table
CREATE TABLE IF NOT EXISTS `api_key` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `account_id` INTEGER NOT NULL , `name` TEXT NOT NULL , `key` TEXT NOT NULL , `role` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index api_key.account_id
CREATE INDEX `IDX_api_key_account_id` ON `api_key` (`account_id`);
-- add index api_key.key
CREATE UNIQUE INDEX `UQE_api_key_key` ON `api_key` (`key`);
-- add index api_key.account_id_name
CREATE UNIQUE INDEX `UQE_api_key_account_id_name` ON `api_key` (`account_id`,`name`);
-- drop index IDX_api_key_account_id - v1
DROP INDEX `IDX_api_key_account_id`;
-- drop index UQE_api_key_key - v1
DROP INDEX `UQE_api_key_key`;
-- drop index UQE_api_key_account_id_name - v1
DROP INDEX `UQE_api_key_account_id_name`;
-- Rename table api_key to api_key_v1 - v1
ALTER TABLE `api_key` RENAME TO `api_key_v1`;
-- create api_key table v2
CREATE TABLE IF NOT EXISTS `api_key` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `name` TEXT NOT NULL , `key` TEXT NOT NULL , `role` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index IDX_api_key_org_id - v2
CREATE INDEX `IDX_api_key_org_id` ON `api_key` (`org_id`);
-- create index UQE_api_key_key - v2
CREATE UNIQUE INDEX `UQE_api_key_key` ON `api_key` (`key`);
-- create index UQE_api_key_org_id_name - v2
CREATE UNIQUE INDEX `UQE_api_key_org_id_name` ON `api_key` (`org_id`,`name`);
-- Drop old table api_key_v1
DROP TABLE IF EXISTS `api_key_v1`;
-- Add expires to api_key table
alter table `api_key` ADD COLUMN `expires` INTEGER NULL;
-- create dashboard_snapshot table v4
CREATE TABLE IF NOT EXISTS `dashboard_snapshot` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `name` TEXT NOT NULL , `key` TEXT NOT NULL , `dashboard` TEXT NOT NULL , `expires` DATETIME NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- drop table dashboard_snapshot_v4 #1
DROP TABLE IF EXISTS `dashboard_snapshot`;
-- create dashboard_snapshot table v5 #2
CREATE TABLE IF NOT EXISTS `dashboard_snapshot` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `name` TEXT NOT NULL , `key` TEXT NOT NULL , `delete_key` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `user_id` INTEGER NOT NULL , `external` INTEGER NOT NULL , `external_url` TEXT NOT NULL , `dashboard` TEXT NOT NULL , `expires` DATETIME NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index UQE_dashboard_snapshot_key - v5
CREATE UNIQUE INDEX `UQE_dashboard_snapshot_key` ON `dashboard_snapshot` (`key`);
-- create index UQE_dashboard_snapshot_delete_key - v5
CREATE UNIQUE INDEX `UQE_dashboard_snapshot_delete_key` ON `dashboard_snapshot` (`delete_key`);
-- create index IDX_dashboard_snapshot_user_id - v5
CREATE INDEX `IDX_dashboard_snapshot_user_id` ON `dashboard_snapshot` (`user_id`);
-- Add column external_delete_url to dashboard_snapshots table
alter table `dashboard_snapshot` ADD COLUMN `external_delete_url` TEXT NULL;
-- create quota table v1
CREATE TABLE IF NOT EXISTS `quota` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NULL , `user_id` INTEGER NULL , `target` TEXT NOT NULL , `limit` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index UQE_quota_org_id_user_id_target - v1
CREATE UNIQUE INDEX `UQE_quota_org_id_user_id_target` ON `quota` (`org_id`,`user_id`,`target`);
-- create plugin_setting table
CREATE TABLE IF NOT EXISTS `plugin_setting` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NULL , `plugin_id` TEXT NOT NULL , `enabled` INTEGER NOT NULL , `pinned` INTEGER NOT NULL , `json_data` TEXT NULL , `secure_json_data` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create index UQE_plugin_setting_org_id_plugin_id - v1
CREATE UNIQUE INDEX `UQE_plugin_setting_org_id_plugin_id` ON `plugin_setting` (`org_id`,`plugin_id`);
-- Add column plugin_version to plugin_settings
alter table `plugin_setting` ADD COLUMN `plugin_version` TEXT NULL;
-- create session table
CREATE TABLE IF NOT EXISTS `session` ( `key` TEXT PRIMARY KEY NOT NULL , `data` BLOB NOT NULL , `expiry` INTEGER NOT NULL );
-- Drop old table playlist table
DROP TABLE IF EXISTS `playlist`;
-- Drop old table playlist_item table
DROP TABLE IF EXISTS `playlist_item`;
-- create playlist table v2
CREATE TABLE IF NOT EXISTS `playlist` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `name` TEXT NOT NULL , `interval` TEXT NOT NULL , `org_id` INTEGER NOT NULL );
-- create playlist item table v2
CREATE TABLE IF NOT EXISTS `playlist_item` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `playlist_id` INTEGER NOT NULL , `type` TEXT NOT NULL , `value` TEXT NOT NULL , `title` TEXT NOT NULL , `order` INTEGER NOT NULL );
-- drop preferences table v2
DROP TABLE IF EXISTS `preferences`;
-- drop preferences table v3
DROP TABLE IF EXISTS `preferences`;
-- create preferences table v3
CREATE TABLE IF NOT EXISTS `preferences` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `user_id` INTEGER NOT NULL , `version` INTEGER NOT NULL , `home_dashboard_id` INTEGER NOT NULL , `timezone` TEXT NOT NULL , `theme` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- Add column team_id in preferences
alter table `preferences` ADD COLUMN `team_id` INTEGER NULL;
-- Update team_id column values in preferences
UPDATE preferences SET team_id=0 WHERE team_id IS NULL;
-- create alert table v1
CREATE TABLE IF NOT EXISTS `alert` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `version` INTEGER NOT NULL , `dashboard_id` INTEGER NOT NULL , `panel_id` INTEGER NOT NULL , `org_id` INTEGER NOT NULL , `name` TEXT NOT NULL , `message` TEXT NOT NULL , `state` TEXT NOT NULL , `settings` TEXT NOT NULL , `frequency` INTEGER NOT NULL , `handler` INTEGER NOT NULL , `severity` TEXT NOT NULL , `silenced` INTEGER NOT NULL , `execution_error` TEXT NOT NULL , `eval_data` TEXT NULL , `eval_date` DATETIME NULL , `new_state_date` DATETIME NOT NULL , `state_changes` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index alert org_id & id 
CREATE INDEX `IDX_alert_org_id_id` ON `alert` (`org_id`,`id`);
-- add index alert state
CREATE INDEX `IDX_alert_state` ON `alert` (`state`);
-- add index alert dashboard_id
CREATE INDEX `IDX_alert_dashboard_id` ON `alert` (`dashboard_id`);
-- Create alert_rule_tag table v1
CREATE TABLE IF NOT EXISTS `alert_rule_tag` ( `alert_id` INTEGER NOT NULL , `tag_id` INTEGER NOT NULL );
-- Add unique index alert_rule_tag.alert_id_tag_id
CREATE UNIQUE INDEX `UQE_alert_rule_tag_alert_id_tag_id` ON `alert_rule_tag` (`alert_id`,`tag_id`);
-- create alert_notification table v1
CREATE TABLE IF NOT EXISTS `alert_notification` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `name` TEXT NOT NULL , `type` TEXT NOT NULL , `settings` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- Add column is_default
alter table `alert_notification` ADD COLUMN `is_default` INTEGER NOT NULL DEFAULT 0;
-- Add column frequency
alter table `alert_notification` ADD COLUMN `frequency` INTEGER NULL;
-- Add column send_reminder
alter table `alert_notification` ADD COLUMN `send_reminder` INTEGER NULL DEFAULT 0;
-- Add column disable_resolve_message
alter table `alert_notification` ADD COLUMN `disable_resolve_message` INTEGER NOT NULL DEFAULT 0;
-- add index alert_notification org_id & name
CREATE UNIQUE INDEX `UQE_alert_notification_org_id_name` ON `alert_notification` (`org_id`,`name`);
-- create notification_journal table v1
CREATE TABLE IF NOT EXISTS `alert_notification_journal` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `alert_id` INTEGER NOT NULL , `notifier_id` INTEGER NOT NULL , `sent_at` INTEGER NOT NULL , `success` INTEGER NOT NULL );
-- add index notification_journal org_id & alert_id & notifier_id
CREATE INDEX `IDX_alert_notification_journal_org_id_alert_id_notifier_id` ON `alert_notification_journal` (`org_id`,`alert_id`,`notifier_id`);
-- drop alert_notification_journal
DROP TABLE IF EXISTS `alert_notification_journal`;
-- create alert_notification_state table v1
CREATE TABLE IF NOT EXISTS `alert_notification_state` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `alert_id` INTEGER NOT NULL , `notifier_id` INTEGER NOT NULL , `state` TEXT NOT NULL , `version` INTEGER NOT NULL , `updated_at` INTEGER NOT NULL , `alert_rule_state_updated_version` INTEGER NOT NULL );
-- add index alert_notification_state org_id & alert_id & notifier_id
CREATE UNIQUE INDEX `UQE_alert_notification_state_org_id_alert_id_notifier_id` ON `alert_notification_state` (`org_id`,`alert_id`,`notifier_id`);
-- Add for to alert table
alter table `alert` ADD COLUMN `for` INTEGER NULL;
-- Add column uid in alert_notification
alter table `alert_notification` ADD COLUMN `uid` TEXT NULL;
-- Update uid column values in alert_notification
UPDATE alert_notification SET uid=printf('%09d',id) WHERE uid IS NULL;
-- Add unique index alert_notification_org_id_uid
CREATE UNIQUE INDEX `UQE_alert_notification_org_id_uid` ON `alert_notification` (`org_id`,`uid`);
-- Remove unique index org_id_name
DROP INDEX `UQE_alert_notification_org_id_name`;
-- Drop old annotation table v4
DROP TABLE IF EXISTS `annotation`;
-- create annotation table v5
CREATE TABLE IF NOT EXISTS `annotation` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `alert_id` INTEGER NULL , `user_id` INTEGER NULL , `dashboard_id` INTEGER NULL , `panel_id` INTEGER NULL , `category_id` INTEGER NULL , `type` TEXT NOT NULL , `title` TEXT NOT NULL , `text` TEXT NOT NULL , `metric` TEXT NULL , `prev_state` TEXT NOT NULL , `new_state` TEXT NOT NULL , `data` TEXT NOT NULL , `epoch` INTEGER NOT NULL );
-- add index annotation 0 v3
CREATE INDEX `IDX_annotation_org_id_alert_id` ON `annotation` (`org_id`,`alert_id`);
-- add index annotation 1 v3
CREATE INDEX `IDX_annotation_org_id_type` ON `annotation` (`org_id`,`type`);
-- add index annotation 2 v3
CREATE INDEX `IDX_annotation_org_id_category_id` ON `annotation` (`org_id`,`category_id`);
-- add index annotation 3 v3
CREATE INDEX `IDX_annotation_org_id_dashboard_id_panel_id_epoch` ON `annotation` (`org_id`,`dashboard_id`,`panel_id`,`epoch`);
-- add index annotation 4 v3
CREATE INDEX `IDX_annotation_org_id_epoch` ON `annotation` (`org_id`,`epoch`);
-- Add column region_id to annotation table
alter table `annotation` ADD COLUMN `region_id` INTEGER NULL DEFAULT 0;
-- Drop category_id index
DROP INDEX `IDX_annotation_org_id_category_id`;
-- Add column tags to annotation table
alter table `annotation` ADD COLUMN `tags` TEXT NULL;
-- Create annotation_tag table v2
CREATE TABLE IF NOT EXISTS `annotation_tag` ( `annotation_id` INTEGER NOT NULL , `tag_id` INTEGER NOT NULL );
-- Add unique index annotation_tag.annotation_id_tag_id
CREATE UNIQUE INDEX `UQE_annotation_tag_annotation_id_tag_id` ON `annotation_tag` (`annotation_id`,`tag_id`);
-- Update alert annotations and set TEXT to empty
UPDATE annotation SET TEXT = '' WHERE alert_id > 0;
-- Add created time to annotation table
alter table `annotation` ADD COLUMN `created` INTEGER NULL DEFAULT 0;
-- Add updated time to annotation table
alter table `annotation` ADD COLUMN `updated` INTEGER NULL DEFAULT 0;
-- Add index for created in annotation table
CREATE INDEX `IDX_annotation_org_id_created` ON `annotation` (`org_id`,`created`);
-- Add index for updated in annotation table
CREATE INDEX `IDX_annotation_org_id_updated` ON `annotation` (`org_id`,`updated`);
-- Convert existing annotations from seconds to milliseconds
UPDATE annotation SET epoch = (epoch*1000) where epoch < 9999999999;
-- Add epoch_end column
alter table `annotation` ADD COLUMN `epoch_end` INTEGER NOT NULL DEFAULT 0;
-- Add index for epoch_end
CREATE INDEX `IDX_annotation_org_id_epoch_epoch_end` ON `annotation` (`org_id`,`epoch`,`epoch_end`);
-- Make epoch_end the same as epoch
UPDATE annotation SET epoch_end = epoch;
-- Remove index org_id_epoch from annotation table
DROP INDEX `IDX_annotation_org_id_epoch`;
-- Remove index org_id_dashboard_id_panel_id_epoch from annotation table
DROP INDEX `IDX_annotation_org_id_dashboard_id_panel_id_epoch`;
-- Add index for org_id_dashboard_id_epoch_end_epoch on annotation table
CREATE INDEX `IDX_annotation_org_id_dashboard_id_epoch_end_epoch` ON `annotation` (`org_id`,`dashboard_id`,`epoch_end`,`epoch`);
-- Add index for org_id_epoch_end_epoch on annotation table
CREATE INDEX `IDX_annotation_org_id_epoch_end_epoch` ON `annotation` (`org_id`,`epoch_end`,`epoch`);
-- Remove index org_id_epoch_epoch_end from annotation table
DROP INDEX `IDX_annotation_org_id_epoch_epoch_end`;
-- Add index for alert_id on annotation table
CREATE INDEX `IDX_annotation_alert_id` ON `annotation` (`alert_id`);
-- create test_data table
CREATE TABLE IF NOT EXISTS `test_data` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `metric1` TEXT NULL , `metric2` TEXT NULL , `value_big_int` INTEGER NULL , `value_double` REAL NULL , `value_float` REAL NULL , `value_int` INTEGER NULL , `time_epoch` INTEGER NOT NULL , `time_date_time` DATETIME NOT NULL , `time_time_stamp` DATETIME NOT NULL );
-- create dashboard_version table v1
CREATE TABLE IF NOT EXISTS `dashboard_version` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `dashboard_id` INTEGER NOT NULL , `parent_version` INTEGER NOT NULL , `restored_from` INTEGER NOT NULL , `version` INTEGER NOT NULL , `created` DATETIME NOT NULL , `created_by` INTEGER NOT NULL , `message` TEXT NOT NULL , `data` TEXT NOT NULL );
-- add index dashboard_version.dashboard_id
CREATE INDEX `IDX_dashboard_version_dashboard_id` ON `dashboard_version` (`dashboard_id`);
-- add unique index dashboard_version.dashboard_id and dashboard_version.version
CREATE UNIQUE INDEX `UQE_dashboard_version_dashboard_id_version` ON `dashboard_version` (`dashboard_id`,`version`);
-- Set dashboard version to 1 where 0
UPDATE dashboard SET version = 1 WHERE version = 0;
-- create team table
CREATE TABLE IF NOT EXISTS `team` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `name` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index team.org_id
CREATE INDEX `IDX_team_org_id` ON `team` (`org_id`);
-- add unique index team_org_id_name
CREATE UNIQUE INDEX `UQE_team_org_id_name` ON `team` (`org_id`,`name`);
-- create team member table
CREATE TABLE IF NOT EXISTS `team_member` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `team_id` INTEGER NOT NULL , `user_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index team_member.org_id
CREATE INDEX `IDX_team_member_org_id` ON `team_member` (`org_id`);
-- add unique index team_member_org_id_team_id_user_id
CREATE UNIQUE INDEX `UQE_team_member_org_id_team_id_user_id` ON `team_member` (`org_id`,`team_id`,`user_id`);
-- Add column email to team table
alter table `team` ADD COLUMN `email` TEXT NULL;
-- Add column external to team_member table
alter table `team_member` ADD COLUMN `external` INTEGER NULL;
-- Add column permission to team_member table
alter table `team_member` ADD COLUMN `permission` INTEGER NULL;
-- create dashboard acl table
CREATE TABLE IF NOT EXISTS `dashboard_acl` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `dashboard_id` INTEGER NOT NULL , `user_id` INTEGER NULL , `team_id` INTEGER NULL , `permission` INTEGER NOT NULL DEFAULT 4 , `role` TEXT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index dashboard_acl_dashboard_id
CREATE INDEX `IDX_dashboard_acl_dashboard_id` ON `dashboard_acl` (`dashboard_id`);
-- add unique index dashboard_acl_dashboard_id_user_id
CREATE UNIQUE INDEX `UQE_dashboard_acl_dashboard_id_user_id` ON `dashboard_acl` (`dashboard_id`,`user_id`);
-- add unique index dashboard_acl_dashboard_id_team_id
CREATE UNIQUE INDEX `UQE_dashboard_acl_dashboard_id_team_id` ON `dashboard_acl` (`dashboard_id`,`team_id`);
-- create tag table
CREATE TABLE IF NOT EXISTS `tag` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `key` TEXT NOT NULL , `value` TEXT NOT NULL );
-- add index tag.key_value
CREATE UNIQUE INDEX `UQE_tag_key_value` ON `tag` (`key`,`value`);
-- create login attempt table
CREATE TABLE IF NOT EXISTS `login_attempt` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `username` TEXT NOT NULL , `ip_address` TEXT NOT NULL , `created` DATETIME NOT NULL );
-- add index login_attempt.username
CREATE INDEX `IDX_login_attempt_username` ON `login_attempt` (`username`);
-- drop index IDX_login_attempt_username - v1
DROP INDEX `IDX_login_attempt_username`;
-- Rename table login_attempt to login_attempt_tmp_qwerty - v1
ALTER TABLE `login_attempt` RENAME TO `login_attempt_tmp_qwerty`;
-- create login_attempt v2
CREATE TABLE IF NOT EXISTS `login_attempt` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `username` TEXT NOT NULL , `ip_address` TEXT NOT NULL , `created` INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_login_attempt_username - v2
CREATE INDEX `IDX_login_attempt_username` ON `login_attempt` (`username`);
-- drop login_attempt_tmp_qwerty
DROP TABLE IF EXISTS `login_attempt_tmp_qwerty`;
-- create user auth table
CREATE TABLE IF NOT EXISTS `user_auth` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `user_id` INTEGER NOT NULL , `auth_module` TEXT NOT NULL , `auth_id` TEXT NOT NULL , `created` DATETIME NOT NULL );
-- create index IDX_user_auth_auth_module_auth_id - v1
CREATE INDEX `IDX_user_auth_auth_module_auth_id` ON `user_auth` (`auth_module`,`auth_id`);
-- Add OAuth access token to user_auth
alter table `user_auth` ADD COLUMN `o_auth_access_token` TEXT NULL;
-- Add OAuth refresh token to user_auth
alter table `user_auth` ADD COLUMN `o_auth_refresh_token` TEXT NULL;
-- Add OAuth token type to user_auth
alter table `user_auth` ADD COLUMN `o_auth_token_type` TEXT NULL;
-- Add OAuth expiry to user_auth
alter table `user_auth` ADD COLUMN `o_auth_expiry` DATETIME NULL;
-- Add index to user_id column in user_auth
CREATE INDEX `IDX_user_auth_user_id` ON `user_auth` (`user_id`);
-- create server_lock table
CREATE TABLE IF NOT EXISTS `server_lock` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `operation_uid` TEXT NOT NULL , `version` INTEGER NOT NULL , `last_execution` INTEGER NOT NULL );
-- add index server_lock.operation_uid
CREATE UNIQUE INDEX `UQE_server_lock_operation_uid` ON `server_lock` (`operation_uid`);
-- create user auth token table
CREATE TABLE IF NOT EXISTS `user_auth_token` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `user_id` INTEGER NOT NULL , `auth_token` TEXT NOT NULL , `prev_auth_token` TEXT NOT NULL , `user_agent` TEXT NOT NULL , `client_ip` TEXT NOT NULL , `auth_token_seen` INTEGER NOT NULL , `seen_at` INTEGER NULL , `rotated_at` INTEGER NOT NULL , `created_at` INTEGER NOT NULL , `updated_at` INTEGER NOT NULL );
-- add unique index user_auth_token.auth_token
CREATE UNIQUE INDEX `UQE_user_auth_token_auth_token` ON `user_auth_token` (`auth_token`);
-- add unique index user_auth_token.prev_auth_token
CREATE UNIQUE INDEX `UQE_user_auth_token_prev_auth_token` ON `user_auth_token` (`prev_auth_token`);
-- create cache_data table
CREATE TABLE IF NOT EXISTS `cache_data` ( `cache_key` TEXT PRIMARY KEY NOT NULL , `data` BLOB NOT NULL , `expires` INTEGER NOT NULL , `created_at` INTEGER NOT NULL );
-- add unique index cache_data.cache_key
CREATE UNIQUE INDEX `UQE_cache_data_cache_key` ON `cache_data` (`cache_key`);
