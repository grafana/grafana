-- create index IDX_org_user_user_id - v1
CREATE INDEX `IDX_org_user_user_id` ON `org_user` (`user_id`);
-- Add index for dashboard_is_folder
CREATE INDEX `IDX_dashboard_is_folder` ON `dashboard` (`is_folder`);
-- add index dashboard_acl_user_id
CREATE INDEX `IDX_dashboard_acl_user_id` ON `dashboard_acl` (`user_id`);
-- add index dashboard_acl_team_id
CREATE INDEX `IDX_dashboard_acl_team_id` ON `dashboard_acl` (`team_id`);
-- add index dashboard_acl_org_id_role
CREATE INDEX `IDX_dashboard_acl_org_id_role` ON `dashboard_acl` (`org_id`,`role`);
-- add index dashboard_permission
CREATE INDEX `IDX_dashboard_acl_permission` ON `dashboard_acl` (`permission`);
-- add dashboard_uid column to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `dashboard_uid` TEXT NULL
-- add panel_id column to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `panel_id` INTEGER NULL
-- add index in alert_rule on org_id, dashboard_uid and panel_id columns
CREATE INDEX `IDX_alert_rule_org_id_dashboard_uid_panel_id` ON `alert_rule` (`org_id`,`dashboard_uid`,`panel_id`);
-- add column org_id in alert_configuration
ALTER TABLE `alert_configuration` ADD COLUMN `org_id` INTEGER NOT NULL DEFAULT 0
-- add index in alert_configuration table on org_id column
CREATE INDEX `IDX_alert_configuration_org_id` ON `alert_configuration` (`org_id`);
-- create_ngalert_configuration_table
CREATE TABLE IF NOT EXISTS `ngalert_configuration` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `alertmanagers` TEXT NULL , `created_at` INTEGER NOT NULL , `updated_at` INTEGER NOT NULL );
-- add index in ngalert_configuration on org_id column
CREATE UNIQUE INDEX `UQE_ngalert_configuration_org_id` ON `ngalert_configuration` (`org_id`);
-- add unique index library_element org_id_uid
CREATE UNIQUE INDEX `UQE_library_element_org_id_uid` ON `library_element` (`org_id`,`uid`);
-- create kv_store table v1
CREATE TABLE IF NOT EXISTS `kv_store` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `namespace` TEXT NOT NULL , `key` TEXT NOT NULL , `value` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index kv_store.org_id-namespace-key
CREATE UNIQUE INDEX `UQE_kv_store_org_id_namespace_key` ON `kv_store` (`org_id`,`namespace`,`key`);
