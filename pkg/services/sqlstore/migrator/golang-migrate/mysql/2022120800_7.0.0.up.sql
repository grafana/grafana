-- create migration_log table
CREATE TABLE IF NOT EXISTS `migration_log` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `migration_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `sql` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `success` TINYINT(1) NOT NULL , `error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `timestamp` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create user table
CREATE TABLE IF NOT EXISTS `user` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` INT NOT NULL , `login` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `salt` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `rands` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `company` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `account_id` BIGINT(20) NOT NULL , `is_admin` TINYINT(1) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index user.login
CREATE UNIQUE INDEX `UQE_user_login` ON `user` (`login`);
-- add unique index user.email
CREATE UNIQUE INDEX `UQE_user_email` ON `user` (`email`);
-- drop index UQE_user_login - v1
DROP INDEX `UQE_user_login` ON `user`
-- drop index UQE_user_email - v1
DROP INDEX `UQE_user_email` ON `user`
-- Rename table user to user_v1 - v1
ALTER TABLE `user` RENAME TO `user_v1`
-- create user table v2
CREATE TABLE IF NOT EXISTS `user` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` INT NOT NULL , `login` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `salt` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `rands` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `company` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `org_id` BIGINT(20) NOT NULL , `is_admin` TINYINT(1) NOT NULL , `email_verified` TINYINT(1) NULL , `theme` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_user_login - v2
CREATE UNIQUE INDEX `UQE_user_login` ON `user` (`login`);
-- create index UQE_user_email - v2
CREATE UNIQUE INDEX `UQE_user_email` ON `user` (`email`);
-- copy data_source v1 to v2
INSERT INTO `user` (`salt` , `rands` , `org_id` , `created` , `id` , `version` , `login` , `name` , `updated` , `email` , `password` , `company` , `is_admin`) SELECT `salt` , `rands` , `account_id` , `created` , `id` , `version` , `login` , `name` , `updated` , `email` , `password` , `company` , `is_admin` FROM `user_v1`
-- Drop old table user_v1
DROP TABLE IF EXISTS `user_v1`
-- Add column help_flags1 to user table
alter table `user` ADD COLUMN `help_flags1` BIGINT(20) NOT NULL DEFAULT 0
-- Update user table charset
ALTER TABLE `user` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `login` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `salt` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `rands` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `company` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `theme` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- Add last_seen_at column to user
alter table `user` ADD COLUMN `last_seen_at` DATETIME NULL
-- Add is_disabled column to user
alter table `user` ADD COLUMN `is_disabled` TINYINT(1) NOT NULL DEFAULT 0
-- Add index user.login/user.email
CREATE INDEX `IDX_user_login_email` ON `user` (`login`,`email`);
-- create temp user table v1-7
CREATE TABLE IF NOT EXISTS `temp_user` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `version` INT NOT NULL , `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `code` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `status` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `invited_by_user_id` BIGINT(20) NULL , `email_sent` TINYINT(1) NOT NULL , `email_sent_on` DATETIME NULL , `remote_addr` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_temp_user_email - v1-7
CREATE INDEX `IDX_temp_user_email` ON `temp_user` (`email`);
-- create index IDX_temp_user_org_id - v1-7
CREATE INDEX `IDX_temp_user_org_id` ON `temp_user` (`org_id`);
-- create index IDX_temp_user_code - v1-7
CREATE INDEX `IDX_temp_user_code` ON `temp_user` (`code`);
-- create index IDX_temp_user_status - v1-7
CREATE INDEX `IDX_temp_user_status` ON `temp_user` (`status`);
-- Update temp_user table charset
ALTER TABLE `temp_user` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `code` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `status` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `remote_addr` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- create star table
CREATE TABLE IF NOT EXISTS `star` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `user_id` BIGINT(20) NOT NULL , `dashboard_id` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index star.user_id_dashboard_id
CREATE UNIQUE INDEX `UQE_star_user_id_dashboard_id` ON `star` (`user_id`,`dashboard_id`);
-- create org table v1
CREATE TABLE IF NOT EXISTS `org` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` INT NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `address1` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `address2` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `city` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `state` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `zip_code` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `country` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `billing_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_org_name - v1
CREATE UNIQUE INDEX `UQE_org_name` ON `org` (`name`);
-- create org_user table v1
CREATE TABLE IF NOT EXISTS `org_user` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NOT NULL , `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_org_user_org_id - v1
CREATE INDEX `IDX_org_user_org_id` ON `org_user` (`org_id`);
-- create index UQE_org_user_org_id_user_id - v1
CREATE UNIQUE INDEX `UQE_org_user_org_id_user_id` ON `org_user` (`org_id`,`user_id`);
-- Update org table charset
ALTER TABLE `org` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `address1` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `address2` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `city` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `state` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `zip_code` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `country` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `billing_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- Update org_user table charset
ALTER TABLE `org_user` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Migrate all Read Only Viewers to Viewers
UPDATE org_user SET role = 'Viewer' WHERE role = 'Read Only Editor'
-- create dashboard table
CREATE TABLE IF NOT EXISTS `dashboard` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` INT NOT NULL , `slug` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `title` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `account_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index dashboard.account_id
CREATE INDEX `IDX_dashboard_account_id` ON `dashboard` (`account_id`);
-- add unique index dashboard_account_id_slug
CREATE UNIQUE INDEX `UQE_dashboard_account_id_slug` ON `dashboard` (`account_id`,`slug`);
-- create dashboard_tag table
CREATE TABLE IF NOT EXISTS `dashboard_tag` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `dashboard_id` BIGINT(20) NOT NULL , `term` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index dashboard_tag.dasboard_id_term
CREATE UNIQUE INDEX `UQE_dashboard_tag_dashboard_id_term` ON `dashboard_tag` (`dashboard_id`,`term`);
-- drop index UQE_dashboard_tag_dashboard_id_term - v1
DROP INDEX `UQE_dashboard_tag_dashboard_id_term` ON `dashboard_tag`
-- Rename table dashboard to dashboard_v1 - v1
ALTER TABLE `dashboard` RENAME TO `dashboard_v1`
-- create dashboard v2
CREATE TABLE IF NOT EXISTS `dashboard` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` INT NOT NULL , `slug` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `title` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_dashboard_org_id - v2
CREATE INDEX `IDX_dashboard_org_id` ON `dashboard` (`org_id`);
-- create index UQE_dashboard_org_id_slug - v2
CREATE UNIQUE INDEX `UQE_dashboard_org_id_slug` ON `dashboard` (`org_id`,`slug`);
-- copy dashboard v1 to v2
INSERT INTO `dashboard` (`slug` , `title` , `data` , `org_id` , `created` , `updated` , `id` , `version`) SELECT `slug` , `title` , `data` , `account_id` , `created` , `updated` , `id` , `version` FROM `dashboard_v1`
-- drop table dashboard_v1
DROP TABLE IF EXISTS `dashboard_v1`
-- alter dashboard.data to mediumtext v1
ALTER TABLE dashboard MODIFY data MEDIUMTEXT;
-- Add column updated_by in dashboard - v2
alter table `dashboard` ADD COLUMN `updated_by` INT NULL
-- Add column created_by in dashboard - v2
alter table `dashboard` ADD COLUMN `created_by` INT NULL
-- Add column gnetId in dashboard
alter table `dashboard` ADD COLUMN `gnet_id` BIGINT(20) NULL
-- Add index for gnetId in dashboard
CREATE INDEX `IDX_dashboard_gnet_id` ON `dashboard` (`gnet_id`);
-- Add column plugin_id in dashboard
alter table `dashboard` ADD COLUMN `plugin_id` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add index for plugin_id in dashboard
CREATE INDEX `IDX_dashboard_org_id_plugin_id` ON `dashboard` (`org_id`,`plugin_id`);
-- Add index for dashboard_id in dashboard_tag
CREATE INDEX `IDX_dashboard_tag_dashboard_id` ON `dashboard_tag` (`dashboard_id`);
-- Update dashboard table charset
ALTER TABLE `dashboard` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `slug` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `title` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `plugin_id` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `data` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Update dashboard_tag table charset
ALTER TABLE `dashboard_tag` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `term` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add column folder_id in dashboard
alter table `dashboard` ADD COLUMN `folder_id` BIGINT(20) NOT NULL DEFAULT 0
-- Add column isFolder in dashboard
alter table `dashboard` ADD COLUMN `is_folder` TINYINT(1) NOT NULL DEFAULT 0
-- Add column has_acl in dashboard
alter table `dashboard` ADD COLUMN `has_acl` TINYINT(1) NOT NULL DEFAULT 0
-- Add column uid in dashboard
alter table `dashboard` ADD COLUMN `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Update uid column values in dashboard
UPDATE dashboard SET uid=lpad(id,9,'0') WHERE uid IS NULL;
-- Add unique index dashboard_org_id_uid
CREATE UNIQUE INDEX `UQE_dashboard_org_id_uid` ON `dashboard` (`org_id`,`uid`);
-- Remove unique index org_id_slug
DROP INDEX `UQE_dashboard_org_id_slug` ON `dashboard`
-- Update dashboard title length
ALTER TABLE `dashboard` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `title` VARCHAR(189) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add unique index for dashboard_org_id_title_folder_id
CREATE UNIQUE INDEX `UQE_dashboard_org_id_folder_id_title` ON `dashboard` (`org_id`,`folder_id`,`title`);
-- create dashboard_provisioning
CREATE TABLE IF NOT EXISTS `dashboard_provisioning` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `dashboard_id` BIGINT(20) NULL , `name` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `external_id` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Rename table dashboard_provisioning to dashboard_provisioning_tmp_qwerty - v1
ALTER TABLE `dashboard_provisioning` RENAME TO `dashboard_provisioning_tmp_qwerty`
-- create dashboard_provisioning v2
CREATE TABLE IF NOT EXISTS `dashboard_provisioning` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `dashboard_id` BIGINT(20) NULL , `name` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `external_id` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `updated` INT NOT NULL DEFAULT 0 ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_dashboard_provisioning_dashboard_id - v2
CREATE INDEX `IDX_dashboard_provisioning_dashboard_id` ON `dashboard_provisioning` (`dashboard_id`);
-- create index IDX_dashboard_provisioning_dashboard_id_name - v2
CREATE INDEX `IDX_dashboard_provisioning_dashboard_id_name` ON `dashboard_provisioning` (`dashboard_id`,`name`);
-- copy dashboard_provisioning v1 to v2
INSERT INTO `dashboard_provisioning` (`id` , `dashboard_id` , `name` , `external_id`) SELECT `id` , `dashboard_id` , `name` , `external_id` FROM `dashboard_provisioning_tmp_qwerty`
-- drop dashboard_provisioning_tmp_qwerty
DROP TABLE IF EXISTS `dashboard_provisioning_tmp_qwerty`
-- Add check_sum column
alter table `dashboard_provisioning` ADD COLUMN `check_sum` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add index for dashboard_title
CREATE INDEX `IDX_dashboard_title` ON `dashboard` (`title`);
-- create data_source table
CREATE TABLE IF NOT EXISTS `data_source` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `account_id` BIGINT(20) NOT NULL , `version` INT NOT NULL , `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `access` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `database` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `basic_auth` TINYINT(1) NOT NULL , `basic_auth_user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `basic_auth_password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `is_default` TINYINT(1) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index data_source.account_id
CREATE INDEX `IDX_data_source_account_id` ON `data_source` (`account_id`);
-- add unique index data_source.account_id_name
CREATE UNIQUE INDEX `UQE_data_source_account_id_name` ON `data_source` (`account_id`,`name`);
-- drop index IDX_data_source_account_id - v1
DROP INDEX `IDX_data_source_account_id` ON `data_source`
-- drop index UQE_data_source_account_id_name - v1
DROP INDEX `UQE_data_source_account_id_name` ON `data_source`
-- Rename table data_source to data_source_v1 - v1
ALTER TABLE `data_source` RENAME TO `data_source_v1`
-- create data_source table v2
CREATE TABLE IF NOT EXISTS `data_source` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `version` INT NOT NULL , `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `access` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `database` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `basic_auth` TINYINT(1) NOT NULL , `basic_auth_user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `basic_auth_password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `is_default` TINYINT(1) NOT NULL , `json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_data_source_org_id - v2
CREATE INDEX `IDX_data_source_org_id` ON `data_source` (`org_id`);
-- create index UQE_data_source_org_id_name - v2
CREATE UNIQUE INDEX `UQE_data_source_org_id_name` ON `data_source` (`org_id`,`name`);
-- copy data_source v1 to v2
INSERT INTO `data_source` (`database` , `url` , `password` , `access` , `user` , `basic_auth_password` , `updated` , `org_id` , `type` , `created` , `version` , `name` , `basic_auth_user` , `is_default` , `id` , `basic_auth`) SELECT `database` , `url` , `password` , `access` , `user` , `basic_auth_password` , `updated` , `account_id` , `type` , `created` , `version` , `name` , `basic_auth_user` , `is_default` , `id` , `basic_auth` FROM `data_source_v1`
-- Drop old table data_source_v1 #2
DROP TABLE IF EXISTS `data_source_v1`
-- Add column with_credentials
alter table `data_source` ADD COLUMN `with_credentials` TINYINT(1) NOT NULL DEFAULT 0
-- Add secure json data column
alter table `data_source` ADD COLUMN `secure_json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Update data_source table charset
ALTER TABLE `data_source` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `access` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `database` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `basic_auth_user` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `basic_auth_password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `secure_json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- Update initial version to 1
UPDATE data_source SET version = 1 WHERE version = 0
-- Add read_only data column
alter table `data_source` ADD COLUMN `read_only` TINYINT(1) NULL
-- Migrate logging ds to loki ds
UPDATE data_source SET type = 'loki' WHERE type = 'logging'
-- Update json_data with nulls
UPDATE data_source SET json_data = '{}' WHERE json_data is null
-- Add uid column
alter table `data_source` ADD COLUMN `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 0
-- Update uid value
UPDATE data_source SET uid=lpad(id,9,'0');
-- Add unique index datasource_org_id_uid
CREATE UNIQUE INDEX `UQE_data_source_org_id_uid` ON `data_source` (`org_id`,`uid`);
-- create api_key table
CREATE TABLE IF NOT EXISTS `api_key` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `account_id` BIGINT(20) NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `key` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `role` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index api_key.account_id
CREATE INDEX `IDX_api_key_account_id` ON `api_key` (`account_id`);
-- add index api_key.key
CREATE UNIQUE INDEX `UQE_api_key_key` ON `api_key` (`key`);
-- add index api_key.account_id_name
CREATE UNIQUE INDEX `UQE_api_key_account_id_name` ON `api_key` (`account_id`,`name`);
-- drop index IDX_api_key_account_id - v1
DROP INDEX `IDX_api_key_account_id` ON `api_key`
-- drop index UQE_api_key_key - v1
DROP INDEX `UQE_api_key_key` ON `api_key`
-- drop index UQE_api_key_account_id_name - v1
DROP INDEX `UQE_api_key_account_id_name` ON `api_key`
-- Rename table api_key to api_key_v1 - v1
ALTER TABLE `api_key` RENAME TO `api_key_v1`
-- create api_key table v2
CREATE TABLE IF NOT EXISTS `api_key` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `role` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_api_key_org_id - v2
CREATE INDEX `IDX_api_key_org_id` ON `api_key` (`org_id`);
-- create index UQE_api_key_key - v2
CREATE UNIQUE INDEX `UQE_api_key_key` ON `api_key` (`key`);
-- create index UQE_api_key_org_id_name - v2
CREATE UNIQUE INDEX `UQE_api_key_org_id_name` ON `api_key` (`org_id`,`name`);
-- copy api_key v1 to v2
INSERT INTO `api_key` (`name` , `key` , `role` , `created` , `updated` , `id` , `org_id`) SELECT `name` , `key` , `role` , `created` , `updated` , `id` , `account_id` FROM `api_key_v1`
-- Drop old table api_key_v1
DROP TABLE IF EXISTS `api_key_v1`
-- Update api_key table charset
ALTER TABLE `api_key` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `role` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add expires to api_key table
alter table `api_key` ADD COLUMN `expires` BIGINT(20) NULL
-- create dashboard_snapshot table v4
CREATE TABLE IF NOT EXISTS `dashboard_snapshot` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `dashboard` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `expires` DATETIME NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- drop table dashboard_snapshot_v4 #1
DROP TABLE IF EXISTS `dashboard_snapshot`
-- create dashboard_snapshot table v5 #2
CREATE TABLE IF NOT EXISTS `dashboard_snapshot` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `delete_key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NOT NULL , `external` TINYINT(1) NOT NULL , `external_url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `dashboard` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `expires` DATETIME NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_dashboard_snapshot_key - v5
CREATE UNIQUE INDEX `UQE_dashboard_snapshot_key` ON `dashboard_snapshot` (`key`);
-- create index UQE_dashboard_snapshot_delete_key - v5
CREATE UNIQUE INDEX `UQE_dashboard_snapshot_delete_key` ON `dashboard_snapshot` (`delete_key`);
-- create index IDX_dashboard_snapshot_user_id - v5
CREATE INDEX `IDX_dashboard_snapshot_user_id` ON `dashboard_snapshot` (`user_id`);
-- alter dashboard_snapshot to mediumtext v2
ALTER TABLE dashboard_snapshot MODIFY dashboard MEDIUMTEXT;
-- Update dashboard_snapshot table charset
ALTER TABLE `dashboard_snapshot` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `delete_key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `external_url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `dashboard` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add column external_delete_url to dashboard_snapshots table
alter table `dashboard_snapshot` ADD COLUMN `external_delete_url` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- create quota table v1
CREATE TABLE IF NOT EXISTS `quota` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NULL , `user_id` BIGINT(20) NULL , `target` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `limit` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_quota_org_id_user_id_target - v1
CREATE UNIQUE INDEX `UQE_quota_org_id_user_id_target` ON `quota` (`org_id`,`user_id`,`target`);
-- Update quota table charset
ALTER TABLE `quota` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `target` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- create plugin_setting table
CREATE TABLE IF NOT EXISTS `plugin_setting` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NULL , `plugin_id` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `enabled` TINYINT(1) NOT NULL , `pinned` TINYINT(1) NOT NULL , `json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `secure_json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index UQE_plugin_setting_org_id_plugin_id - v1
CREATE UNIQUE INDEX `UQE_plugin_setting_org_id_plugin_id` ON `plugin_setting` (`org_id`,`plugin_id`);
-- Add column plugin_version to plugin_settings
alter table `plugin_setting` ADD COLUMN `plugin_version` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Update plugin_setting table charset
ALTER TABLE `plugin_setting` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `plugin_id` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `secure_json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `plugin_version` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- create session table
CREATE TABLE IF NOT EXISTS `session` ( `key` CHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL , `data` BLOB NOT NULL , `expiry` INTEGER(255) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Drop old table playlist table
DROP TABLE IF EXISTS `playlist`
-- Drop old table playlist_item table
DROP TABLE IF EXISTS `playlist_item`
-- create playlist table v2
CREATE TABLE IF NOT EXISTS `playlist` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `interval` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create playlist item table v2
CREATE TABLE IF NOT EXISTS `playlist_item` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `playlist_id` BIGINT(20) NOT NULL , `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `value` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `title` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `order` INT NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Update playlist table charset
ALTER TABLE `playlist` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `interval` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Update playlist_item table charset
ALTER TABLE `playlist_item` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `value` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `title` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- drop preferences table v2
DROP TABLE IF EXISTS `preferences`
-- drop preferences table v3
DROP TABLE IF EXISTS `preferences`
-- create preferences table v3
CREATE TABLE IF NOT EXISTS `preferences` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NOT NULL , `version` INT NOT NULL , `home_dashboard_id` BIGINT(20) NOT NULL , `timezone` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `theme` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Update preferences table charset
ALTER TABLE `preferences` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `timezone` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `theme` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add column team_id in preferences
alter table `preferences` ADD COLUMN `team_id` BIGINT(20) NULL
-- Update team_id column values in preferences
UPDATE preferences SET team_id=0 WHERE team_id IS NULL;
-- create alert table v1
CREATE TABLE IF NOT EXISTS `alert` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `version` BIGINT(20) NOT NULL , `dashboard_id` BIGINT(20) NOT NULL , `panel_id` BIGINT(20) NOT NULL , `org_id` BIGINT(20) NOT NULL , `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `message` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `state` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `frequency` BIGINT(20) NOT NULL , `handler` BIGINT(20) NOT NULL , `severity` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `silenced` TINYINT(1) NOT NULL , `execution_error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `eval_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `eval_date` DATETIME NULL , `new_state_date` DATETIME NOT NULL , `state_changes` INT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index alert org_id & id 
CREATE INDEX `IDX_alert_org_id_id` ON `alert` (`org_id`,`id`);
-- add index alert state
CREATE INDEX `IDX_alert_state` ON `alert` (`state`);
-- add index alert dashboard_id
CREATE INDEX `IDX_alert_dashboard_id` ON `alert` (`dashboard_id`);
-- Create alert_rule_tag table v1
CREATE TABLE IF NOT EXISTS `alert_rule_tag` ( `alert_id` BIGINT(20) NOT NULL , `tag_id` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Add unique index alert_rule_tag.alert_id_tag_id
CREATE UNIQUE INDEX `UQE_alert_rule_tag_alert_id_tag_id` ON `alert_rule_tag` (`alert_id`,`tag_id`);
-- create alert_notification table v1
CREATE TABLE IF NOT EXISTS `alert_notification` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Add column is_default
alter table `alert_notification` ADD COLUMN `is_default` TINYINT(1) NOT NULL DEFAULT 0
-- Add column frequency
alter table `alert_notification` ADD COLUMN `frequency` BIGINT(20) NULL
-- Add column send_reminder
alter table `alert_notification` ADD COLUMN `send_reminder` TINYINT(1) NULL DEFAULT 0
-- Add column disable_resolve_message
alter table `alert_notification` ADD COLUMN `disable_resolve_message` TINYINT(1) NOT NULL DEFAULT 0
-- add index alert_notification org_id & name
CREATE UNIQUE INDEX `UQE_alert_notification_org_id_name` ON `alert_notification` (`org_id`,`name`);
-- Update alert table charset
ALTER TABLE `alert` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `message` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `state` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `severity` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `execution_error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `eval_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ;
-- Update alert_notification table charset
ALTER TABLE `alert_notification` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- create notification_journal table v1
CREATE TABLE IF NOT EXISTS `alert_notification_journal` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `alert_id` BIGINT(20) NOT NULL , `notifier_id` BIGINT(20) NOT NULL , `sent_at` BIGINT(20) NOT NULL , `success` TINYINT(1) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index notification_journal org_id & alert_id & notifier_id
CREATE INDEX `IDX_alert_notification_journal_org_id_alert_id_notifier_id` ON `alert_notification_journal` (`org_id`,`alert_id`,`notifier_id`);
-- drop alert_notification_journal
DROP TABLE IF EXISTS `alert_notification_journal`
-- create alert_notification_state table v1
CREATE TABLE IF NOT EXISTS `alert_notification_state` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `alert_id` BIGINT(20) NOT NULL , `notifier_id` BIGINT(20) NOT NULL , `state` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `version` BIGINT(20) NOT NULL , `updated_at` BIGINT(20) NOT NULL , `alert_rule_state_updated_version` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index alert_notification_state org_id & alert_id & notifier_id
CREATE UNIQUE INDEX `UQE_alert_notification_state_org_id_alert_id_notifier_id` ON `alert_notification_state` (`org_id`,`alert_id`,`notifier_id`);
-- Add for to alert table
alter table `alert` ADD COLUMN `for` BIGINT(20) NULL
-- Add column uid in alert_notification
alter table `alert_notification` ADD COLUMN `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Update uid column values in alert_notification
UPDATE alert_notification SET uid=lpad(id,9,'0') WHERE uid IS NULL;
-- Add unique index alert_notification_org_id_uid
CREATE UNIQUE INDEX `UQE_alert_notification_org_id_uid` ON `alert_notification` (`org_id`,`uid`);
-- Remove unique index org_id_name
DROP INDEX `UQE_alert_notification_org_id_name` ON `alert_notification`
-- Drop old annotation table v4
DROP TABLE IF EXISTS `annotation`
-- create annotation table v5
CREATE TABLE IF NOT EXISTS `annotation` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `alert_id` BIGINT(20) NULL , `user_id` BIGINT(20) NULL , `dashboard_id` BIGINT(20) NULL , `panel_id` BIGINT(20) NULL , `category_id` BIGINT(20) NULL , `type` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `title` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `text` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `metric` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `prev_state` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `new_state` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `epoch` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
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
-- Update annotation table charset
ALTER TABLE `annotation` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `type` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `title` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `text` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `metric` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , MODIFY `prev_state` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `new_state` VARCHAR(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , MODIFY `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- Add column region_id to annotation table
alter table `annotation` ADD COLUMN `region_id` BIGINT(20) NULL DEFAULT 0
-- Drop category_id index
DROP INDEX `IDX_annotation_org_id_category_id` ON `annotation`
-- Add column tags to annotation table
alter table `annotation` ADD COLUMN `tags` VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Create annotation_tag table v2
CREATE TABLE IF NOT EXISTS `annotation_tag` ( `annotation_id` BIGINT(20) NOT NULL , `tag_id` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Add unique index annotation_tag.annotation_id_tag_id
CREATE UNIQUE INDEX `UQE_annotation_tag_annotation_id_tag_id` ON `annotation_tag` (`annotation_id`,`tag_id`);
-- Update alert annotations and set TEXT to empty
UPDATE annotation SET TEXT = '' WHERE alert_id > 0
-- Add created time to annotation table
alter table `annotation` ADD COLUMN `created` BIGINT(20) NULL DEFAULT 0
-- Add updated time to annotation table
alter table `annotation` ADD COLUMN `updated` BIGINT(20) NULL DEFAULT 0
-- Add index for created in annotation table
CREATE INDEX `IDX_annotation_org_id_created` ON `annotation` (`org_id`,`created`);
-- Add index for updated in annotation table
CREATE INDEX `IDX_annotation_org_id_updated` ON `annotation` (`org_id`,`updated`);
-- Convert existing annotations from seconds to milliseconds
UPDATE annotation SET epoch = (epoch*1000) where epoch < 9999999999
-- Add epoch_end column
alter table `annotation` ADD COLUMN `epoch_end` BIGINT(20) NOT NULL DEFAULT 0
-- Add index for epoch_end
CREATE INDEX `IDX_annotation_org_id_epoch_epoch_end` ON `annotation` (`org_id`,`epoch`,`epoch_end`);
-- Make epoch_end the same as epoch
UPDATE annotation SET epoch_end = epoch
-- Remove index org_id_epoch from annotation table
DROP INDEX `IDX_annotation_org_id_epoch` ON `annotation`
-- Remove index org_id_dashboard_id_panel_id_epoch from annotation table
DROP INDEX `IDX_annotation_org_id_dashboard_id_panel_id_epoch` ON `annotation`
-- Add index for org_id_dashboard_id_epoch_end_epoch on annotation table
CREATE INDEX `IDX_annotation_org_id_dashboard_id_epoch_end_epoch` ON `annotation` (`org_id`,`dashboard_id`,`epoch_end`,`epoch`);
-- Add index for org_id_epoch_end_epoch on annotation table
CREATE INDEX `IDX_annotation_org_id_epoch_end_epoch` ON `annotation` (`org_id`,`epoch_end`,`epoch`);
-- Remove index org_id_epoch_epoch_end from annotation table
DROP INDEX `IDX_annotation_org_id_epoch_epoch_end` ON `annotation`
-- Add index for alert_id on annotation table
CREATE INDEX `IDX_annotation_alert_id` ON `annotation` (`alert_id`);
-- create test_data table
CREATE TABLE IF NOT EXISTS `test_data` ( `id` INT PRIMARY KEY AUTO_INCREMENT NOT NULL , `metric1` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `metric2` VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `value_big_int` BIGINT(20) NULL , `value_double` DOUBLE NULL , `value_float` FLOAT NULL , `value_int` INT NULL , `time_epoch` BIGINT(20) NOT NULL , `time_date_time` DATETIME NOT NULL , `time_time_stamp` TIMESTAMP NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create dashboard_version table v1
CREATE TABLE IF NOT EXISTS `dashboard_version` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `dashboard_id` BIGINT(20) NOT NULL , `parent_version` INT NOT NULL , `restored_from` INT NOT NULL , `version` INT NOT NULL , `created` DATETIME NOT NULL , `created_by` BIGINT(20) NOT NULL , `message` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index dashboard_version.dashboard_id
CREATE INDEX `IDX_dashboard_version_dashboard_id` ON `dashboard_version` (`dashboard_id`);
-- add unique index dashboard_version.dashboard_id and dashboard_version.version
CREATE UNIQUE INDEX `UQE_dashboard_version_dashboard_id_version` ON `dashboard_version` (`dashboard_id`,`version`);
-- Set dashboard version to 1 where 0
UPDATE dashboard SET version = 1 WHERE version = 0
-- save existing dashboard data in dashboard_version table v1
INSERT INTO dashboard_version ( dashboard_id, version, parent_version, restored_from, created, created_by, message, data ) SELECT dashboard.id, dashboard.version, dashboard.version, dashboard.version, dashboard.updated, COALESCE(dashboard.updated_by, -1), '', dashboard.data FROM dashboard;
-- alter dashboard_version.data to mediumtext v1
ALTER TABLE dashboard_version MODIFY data MEDIUMTEXT;
-- create team table
CREATE TABLE IF NOT EXISTS `team` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index team.org_id
CREATE INDEX `IDX_team_org_id` ON `team` (`org_id`);
-- add unique index team_org_id_name
CREATE UNIQUE INDEX `UQE_team_org_id_name` ON `team` (`org_id`,`name`);
-- create team member table
CREATE TABLE IF NOT EXISTS `team_member` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `team_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index team_member.org_id
CREATE INDEX `IDX_team_member_org_id` ON `team_member` (`org_id`);
-- add unique index team_member_org_id_team_id_user_id
CREATE UNIQUE INDEX `UQE_team_member_org_id_team_id_user_id` ON `team_member` (`org_id`,`team_id`,`user_id`);
-- Add column email to team table
alter table `team` ADD COLUMN `email` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add column external to team_member table
alter table `team_member` ADD COLUMN `external` TINYINT(1) NULL
-- Add column permission to team_member table
alter table `team_member` ADD COLUMN `permission` SMALLINT NULL
-- create dashboard acl table
CREATE TABLE IF NOT EXISTS `dashboard_acl` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `dashboard_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NULL , `team_id` BIGINT(20) NULL , `permission` SMALLINT NOT NULL DEFAULT 4 , `role` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index dashboard_acl_dashboard_id
CREATE INDEX `IDX_dashboard_acl_dashboard_id` ON `dashboard_acl` (`dashboard_id`);
-- add unique index dashboard_acl_dashboard_id_user_id
CREATE UNIQUE INDEX `UQE_dashboard_acl_dashboard_id_user_id` ON `dashboard_acl` (`dashboard_id`,`user_id`);
-- add unique index dashboard_acl_dashboard_id_team_id
CREATE UNIQUE INDEX `UQE_dashboard_acl_dashboard_id_team_id` ON `dashboard_acl` (`dashboard_id`,`team_id`);
-- save default acl rules in dashboard_acl table
 INSERT INTO dashboard_acl ( org_id, dashboard_id, permission, role, created, updated ) VALUES (-1,-1, 1,'Viewer','2017-06-20','2017-06-20'), (-1,-1, 2,'Editor','2017-06-20','2017-06-20') 
-- create tag table
CREATE TABLE IF NOT EXISTS `tag` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `key` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `value` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index tag.key_value
CREATE UNIQUE INDEX `UQE_tag_key_value` ON `tag` (`key`,`value`);
-- create login attempt table
CREATE TABLE IF NOT EXISTS `login_attempt` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `username` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `ip_address` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index login_attempt.username
CREATE INDEX `IDX_login_attempt_username` ON `login_attempt` (`username`);
-- drop index IDX_login_attempt_username - v1
DROP INDEX `IDX_login_attempt_username` ON `login_attempt`
-- Rename table login_attempt to login_attempt_tmp_qwerty - v1
ALTER TABLE `login_attempt` RENAME TO `login_attempt_tmp_qwerty`
-- create login_attempt v2
CREATE TABLE IF NOT EXISTS `login_attempt` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `username` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `ip_address` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` INT NOT NULL DEFAULT 0 ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_login_attempt_username - v2
CREATE INDEX `IDX_login_attempt_username` ON `login_attempt` (`username`);
-- copy login_attempt v1 to v2
INSERT INTO `login_attempt` (`id` , `username` , `ip_address`) SELECT `id` , `username` , `ip_address` FROM `login_attempt_tmp_qwerty`
-- drop login_attempt_tmp_qwerty
DROP TABLE IF EXISTS `login_attempt_tmp_qwerty`
-- create user auth table
CREATE TABLE IF NOT EXISTS `user_auth` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `user_id` BIGINT(20) NOT NULL , `auth_module` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `auth_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- create index IDX_user_auth_auth_module_auth_id - v1
CREATE INDEX `IDX_user_auth_auth_module_auth_id` ON `user_auth` (`auth_module`,`auth_id`);
-- alter user_auth.auth_id to length 190
ALTER TABLE user_auth MODIFY auth_id VARCHAR(190);
-- Add OAuth access token to user_auth
alter table `user_auth` ADD COLUMN `o_auth_access_token` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add OAuth refresh token to user_auth
alter table `user_auth` ADD COLUMN `o_auth_refresh_token` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add OAuth token type to user_auth
alter table `user_auth` ADD COLUMN `o_auth_token_type` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- Add OAuth expiry to user_auth
alter table `user_auth` ADD COLUMN `o_auth_expiry` DATETIME NULL
-- Add index to user_id column in user_auth
CREATE INDEX `IDX_user_auth_user_id` ON `user_auth` (`user_id`);
-- create server_lock table
CREATE TABLE IF NOT EXISTS `server_lock` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `operation_uid` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `version` BIGINT(20) NOT NULL , `last_execution` BIGINT(20) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index server_lock.operation_uid
CREATE UNIQUE INDEX `UQE_server_lock_operation_uid` ON `server_lock` (`operation_uid`);
-- create user auth token table
CREATE TABLE IF NOT EXISTS `user_auth_token` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `user_id` BIGINT(20) NOT NULL , `auth_token` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `prev_auth_token` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `user_agent` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `client_ip` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `auth_token_seen` TINYINT(1) NOT NULL , `seen_at` INT NULL , `rotated_at` INT NOT NULL , `created_at` INT NOT NULL , `updated_at` INT NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index user_auth_token.auth_token
CREATE UNIQUE INDEX `UQE_user_auth_token_auth_token` ON `user_auth_token` (`auth_token`);
-- add unique index user_auth_token.prev_auth_token
CREATE UNIQUE INDEX `UQE_user_auth_token_prev_auth_token` ON `user_auth_token` (`prev_auth_token`);
-- create cache_data table
CREATE TABLE IF NOT EXISTS `cache_data` ( `cache_key` VARCHAR(168) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL , `data` BLOB NOT NULL , `expires` INTEGER(255) NOT NULL , `created_at` INTEGER(255) NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index cache_data.cache_key
CREATE UNIQUE INDEX `UQE_cache_data_cache_key` ON `cache_data` (`cache_key`);
