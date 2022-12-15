-- drop index IDX_temp_user_email - v1
DROP INDEX `IDX_temp_user_email` ON `temp_user`
-- drop index IDX_temp_user_org_id - v1
DROP INDEX `IDX_temp_user_org_id` ON `temp_user`
-- drop index IDX_temp_user_code - v1
DROP INDEX `IDX_temp_user_code` ON `temp_user`
-- drop index IDX_temp_user_status - v1
DROP INDEX `IDX_temp_user_status` ON `temp_user`
-- Rename table temp_user to temp_user_tmp_qwerty - v1
ALTER TABLE `temp_user` RENAME TO `temp_user_tmp_qwerty`
-- create temp_user v2
CREATE TABLE IF NOT EXISTS `temp_user` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `version` INT NOT NULL , `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `code` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `status` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `invited_by_user_id` BIGINT(20) NULL , `email_sent` TINYINT(1) NOT NULL , `email_sent_on` DATETIME NULL , `remote_addr` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` INT NOT NULL DEFAULT 0 , `updated` INT NOT NULL DEFAULT 0 ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_temp_user_email - v2
CREATE INDEX `IDX_temp_user_email` ON `temp_user` (`email`);
-- create index IDX_temp_user_org_id - v2
CREATE INDEX `IDX_temp_user_org_id` ON `temp_user` (`org_id`);
-- create index IDX_temp_user_code - v2
CREATE INDEX `IDX_temp_user_code` ON `temp_user` (`code`);
-- create index IDX_temp_user_status - v2
CREATE INDEX `IDX_temp_user_status` ON `temp_user` (`status`);
-- copy temp_user v1 to v2
INSERT INTO `temp_user` (`email_sent` , `id` , `version` , `email` , `name` , `role` , `status` , `invited_by_user_id` , `email_sent_on` , `org_id` , `code` , `remote_addr`) SELECT `email_sent` , `id` , `version` , `email` , `name` , `role` , `status` , `invited_by_user_id` , `email_sent_on` , `org_id` , `code` , `remote_addr` FROM `temp_user_tmp_qwerty`
-- drop temp_user_tmp_qwerty
DROP TABLE IF EXISTS `temp_user_tmp_qwerty`
-- Add encrypted dashboard json column
alter table `dashboard_snapshot` ADD COLUMN `dashboard_encrypted` BLOB NULL
-- Add non-unique index alert_notification_state_alert_id
CREATE INDEX `IDX_alert_notification_state_alert_id` ON `alert_notification_state` (`alert_id`);
-- Add non-unique index alert_rule_tag_alert_id
CREATE INDEX `IDX_alert_rule_tag_alert_id` ON `alert_rule_tag` (`alert_id`);
-- add index user_auth_token.user_id
CREATE INDEX `IDX_user_auth_token_user_id` ON `user_auth_token` (`user_id`);
-- create short_url table v1
CREATE TABLE IF NOT EXISTS `short_url` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `path` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created_by` INT NOT NULL , `created_at` INT NOT NULL , `last_seen_at` INT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index short_url.org_id-uid
CREATE UNIQUE INDEX `UQE_short_url_org_id_uid` ON `short_url` (`org_id`,`uid`);
