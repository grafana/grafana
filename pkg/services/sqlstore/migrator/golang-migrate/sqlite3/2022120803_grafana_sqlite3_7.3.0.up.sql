-- drop index IDX_temp_user_email - v1
DROP INDEX `IDX_temp_user_email`;
-- drop index IDX_temp_user_org_id - v1
DROP INDEX `IDX_temp_user_org_id`;
-- drop index IDX_temp_user_code - v1
DROP INDEX `IDX_temp_user_code`;
-- drop index IDX_temp_user_status - v1
DROP INDEX `IDX_temp_user_status`;
-- Rename table temp_user to temp_user_tmp_qwerty - v1
ALTER TABLE `temp_user` RENAME TO `temp_user_tmp_qwerty`;
-- create temp_user v2
CREATE TABLE IF NOT EXISTS `temp_user` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `version` INTEGER NOT NULL , `email` TEXT NOT NULL , `name` TEXT NULL , `role` TEXT NULL , `code` TEXT NOT NULL , `status` TEXT NOT NULL , `invited_by_user_id` INTEGER NULL , `email_sent` INTEGER NOT NULL , `email_sent_on` DATETIME NULL , `remote_addr` TEXT NULL , `created` INTEGER NOT NULL DEFAULT 0 , `updated` INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_temp_user_email - v2
CREATE INDEX `IDX_temp_user_email` ON `temp_user` (`email`);
-- create index IDX_temp_user_org_id - v2
CREATE INDEX `IDX_temp_user_org_id` ON `temp_user` (`org_id`);
-- create index IDX_temp_user_code - v2
CREATE INDEX `IDX_temp_user_code` ON `temp_user` (`code`);
-- create index IDX_temp_user_status - v2
CREATE INDEX `IDX_temp_user_status` ON `temp_user` (`status`);
-- drop temp_user_tmp_qwerty
DROP TABLE IF EXISTS `temp_user_tmp_qwerty`;
-- Add encrypted dashboard json column
ALTER TABLE `dashboard_snapshot` ADD COLUMN `dashboard_encrypted` BLOB NULL;
-- Add non-unique index alert_notification_state_alert_id
CREATE INDEX `IDX_alert_notification_state_alert_id` ON `alert_notification_state` (`alert_id`);
-- Add non-unique index alert_rule_tag_alert_id
CREATE INDEX `IDX_alert_rule_tag_alert_id` ON `alert_rule_tag` (`alert_id`);
-- add index user_auth_token.user_id
CREATE INDEX `IDX_user_auth_token_user_id` ON `user_auth_token` (`user_id`);
-- create short_url table v1
CREATE TABLE IF NOT EXISTS `short_url` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `uid` TEXT NOT NULL , `path` TEXT NOT NULL , `created_by` INTEGER NOT NULL , `created_at` INTEGER NOT NULL , `last_seen_at` INTEGER NULL );
-- add index short_url.org_id-uid
CREATE UNIQUE INDEX `UQE_short_url_org_id_uid` ON `short_url` (`org_id`,`uid`);
