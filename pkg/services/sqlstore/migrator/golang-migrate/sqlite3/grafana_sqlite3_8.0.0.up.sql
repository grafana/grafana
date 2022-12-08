-- delete alert_definition table
DROP TABLE IF EXISTS `alert_definition`
-- recreate alert_definition table
CREATE TABLE IF NOT EXISTS `alert_definition` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `title` TEXT NOT NULL , `condition` TEXT NOT NULL , `data` TEXT NOT NULL , `updated` DATETIME NOT NULL , `interval_seconds` INTEGER NOT NULL DEFAULT 60 , `version` INTEGER NOT NULL DEFAULT 0 , `uid` TEXT NOT NULL DEFAULT 0 );
-- add index in alert_definition on org_id and title columns
CREATE INDEX `IDX_alert_definition_org_id_title` ON `alert_definition` (`org_id`,`title`);
-- add index in alert_definition on org_id and uid columns
CREATE INDEX `IDX_alert_definition_org_id_uid` ON `alert_definition` (`org_id`,`uid`);
-- drop index in alert_definition on org_id and title columns
DROP INDEX `IDX_alert_definition_org_id_title`
-- drop index in alert_definition on org_id and uid columns
DROP INDEX `IDX_alert_definition_org_id_uid`
-- add unique index in alert_definition on org_id and title columns
CREATE UNIQUE INDEX `UQE_alert_definition_org_id_title` ON `alert_definition` (`org_id`,`title`);
-- add unique index in alert_definition on org_id and uid columns
CREATE UNIQUE INDEX `UQE_alert_definition_org_id_uid` ON `alert_definition` (`org_id`,`uid`);
-- Add column paused in alert_definition
ALTER TABLE `alert_definition` ADD COLUMN `paused` INTEGER NOT NULL DEFAULT 0
-- drop alert_definition table
DROP TABLE IF EXISTS `alert_definition`
-- delete alert_definition_version table
DROP TABLE IF EXISTS `alert_definition_version`
-- recreate alert_definition_version table
CREATE TABLE IF NOT EXISTS `alert_definition_version` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `alert_definition_id` INTEGER NOT NULL , `alert_definition_uid` TEXT NOT NULL DEFAULT 0 , `parent_version` INTEGER NOT NULL , `restored_from` INTEGER NOT NULL , `version` INTEGER NOT NULL , `created` DATETIME NOT NULL , `title` TEXT NOT NULL , `condition` TEXT NOT NULL , `data` TEXT NOT NULL , `interval_seconds` INTEGER NOT NULL );
-- add index in alert_definition_version table on alert_definition_id and version columns
CREATE UNIQUE INDEX `UQE_alert_definition_version_alert_definition_id_version` ON `alert_definition_version` (`alert_definition_id`,`version`);
-- add index in alert_definition_version table on alert_definition_uid and version columns
CREATE UNIQUE INDEX `UQE_alert_definition_version_alert_definition_uid_version` ON `alert_definition_version` (`alert_definition_uid`,`version`);
-- drop alert_definition_version table
DROP TABLE IF EXISTS `alert_definition_version`
-- create alert_instance table
CREATE TABLE IF NOT EXISTS `alert_instance` ( `def_org_id` INTEGER NOT NULL , `def_uid` TEXT NOT NULL DEFAULT 0 , `labels` TEXT NOT NULL , `labels_hash` TEXT NOT NULL , `current_state` TEXT NOT NULL , `current_state_since` INTEGER NOT NULL , `last_eval_time` INTEGER NOT NULL , PRIMARY KEY ( `def_org_id`,`def_uid`,`labels_hash` ));
-- add index in alert_instance table on def_org_id, def_uid and current_state columns
CREATE INDEX `IDX_alert_instance_def_org_id_def_uid_current_state` ON `alert_instance` (`def_org_id`,`def_uid`,`current_state`);
-- add index in alert_instance table on def_org_id, current_state columns
CREATE INDEX `IDX_alert_instance_def_org_id_current_state` ON `alert_instance` (`def_org_id`,`current_state`);
-- add column current_state_end to alert_instance
ALTER TABLE `alert_instance` ADD COLUMN `current_state_end` INTEGER NOT NULL DEFAULT 0
-- remove index def_org_id, def_uid, current_state on alert_instance
DROP INDEX `IDX_alert_instance_def_org_id_def_uid_current_state`
-- remove index def_org_id, current_state on alert_instance
DROP INDEX `IDX_alert_instance_def_org_id_current_state`
-- rename def_org_id to rule_org_id in alert_instance
ALTER TABLE alert_instance RENAME COLUMN def_org_id TO rule_org_id;
-- rename def_uid to rule_uid in alert_instance
ALTER TABLE alert_instance RENAME COLUMN def_uid TO rule_uid;
-- add index rule_org_id, rule_uid, current_state on alert_instance
CREATE INDEX `IDX_alert_instance_rule_org_id_rule_uid_current_state` ON `alert_instance` (`rule_org_id`,`rule_uid`,`current_state`);
-- add index rule_org_id, current_state on alert_instance
CREATE INDEX `IDX_alert_instance_rule_org_id_current_state` ON `alert_instance` (`rule_org_id`,`current_state`);
-- create alert_rule table
CREATE TABLE IF NOT EXISTS `alert_rule` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `title` TEXT NOT NULL , `condition` TEXT NOT NULL , `data` TEXT NOT NULL , `updated` DATETIME NOT NULL , `interval_seconds` INTEGER NOT NULL DEFAULT 60 , `version` INTEGER NOT NULL DEFAULT 0 , `uid` TEXT NOT NULL DEFAULT 0 , `namespace_uid` TEXT NOT NULL , `rule_group` TEXT NOT NULL , `no_data_state` TEXT NOT NULL DEFAULT 'NoData' , `exec_err_state` TEXT NOT NULL DEFAULT 'Alerting' );
-- add index in alert_rule on org_id and title columns
CREATE UNIQUE INDEX `UQE_alert_rule_org_id_title` ON `alert_rule` (`org_id`,`title`);
-- add index in alert_rule on org_id and uid columns
CREATE UNIQUE INDEX `UQE_alert_rule_org_id_uid` ON `alert_rule` (`org_id`,`uid`);
-- add index in alert_rule on org_id, namespace_uid, group_uid columns
CREATE INDEX `IDX_alert_rule_org_id_namespace_uid_rule_group` ON `alert_rule` (`org_id`,`namespace_uid`,`rule_group`);
-- add column for to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `for` INTEGER NOT NULL DEFAULT 0
-- add column annotations to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `annotations` TEXT NULL
-- add column labels to alert_rule
ALTER TABLE `alert_rule` ADD COLUMN `labels` TEXT NULL
-- remove unique index from alert_rule on org_id, title columns
DROP INDEX `UQE_alert_rule_org_id_title`
-- add index in alert_rule on org_id, namespase_uid and title columns
CREATE UNIQUE INDEX `UQE_alert_rule_org_id_namespace_uid_title` ON `alert_rule` (`org_id`,`namespace_uid`,`title`);
-- create alert_rule_version table
CREATE TABLE IF NOT EXISTS `alert_rule_version` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `rule_org_id` INTEGER NOT NULL , `rule_uid` TEXT NOT NULL DEFAULT 0 , `rule_namespace_uid` TEXT NOT NULL , `rule_group` TEXT NOT NULL , `parent_version` INTEGER NOT NULL , `restored_from` INTEGER NOT NULL , `version` INTEGER NOT NULL , `created` DATETIME NOT NULL , `title` TEXT NOT NULL , `condition` TEXT NOT NULL , `data` TEXT NOT NULL , `interval_seconds` INTEGER NOT NULL , `no_data_state` TEXT NOT NULL DEFAULT 'NoData' , `exec_err_state` TEXT NOT NULL DEFAULT 'Alerting' );
-- add index in alert_rule_version table on rule_org_id, rule_uid and version columns
CREATE UNIQUE INDEX `UQE_alert_rule_version_rule_org_id_rule_uid_version` ON `alert_rule_version` (`rule_org_id`,`rule_uid`,`version`);
-- add index in alert_rule_version table on rule_org_id, rule_namespace_uid and rule_group columns
CREATE INDEX `IDX_alert_rule_version_rule_org_id_rule_namespace_uid_rule_group` ON `alert_rule_version` (`rule_org_id`,`rule_namespace_uid`,`rule_group`);
-- add column for to alert_rule_version
ALTER TABLE `alert_rule_version` ADD COLUMN `for` INTEGER NOT NULL DEFAULT 0
-- add column annotations to alert_rule_version
ALTER TABLE `alert_rule_version` ADD COLUMN `annotations` TEXT NULL
-- add column labels to alert_rule_version
ALTER TABLE `alert_rule_version` ADD COLUMN `labels` TEXT NULL
-- create_alert_configuration_table
CREATE TABLE IF NOT EXISTS `alert_configuration` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `alertmanager_configuration` TEXT NOT NULL , `configuration_version` TEXT NOT NULL , `created_at` INTEGER NOT NULL );
-- Add column default in alert_configuration
ALTER TABLE `alert_configuration` ADD COLUMN `default` INTEGER NOT NULL DEFAULT 0
-- create library_element table v1
CREATE TABLE IF NOT EXISTS `library_element` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `folder_id` INTEGER NOT NULL , `uid` TEXT NOT NULL , `name` TEXT NOT NULL , `kind` INTEGER NOT NULL , `type` TEXT NOT NULL , `description` TEXT NOT NULL , `model` TEXT NOT NULL , `created` DATETIME NOT NULL , `created_by` INTEGER NOT NULL , `updated` DATETIME NOT NULL , `updated_by` INTEGER NOT NULL , `version` INTEGER NOT NULL );
-- add index library_element org_id-folder_id-name-kind
CREATE UNIQUE INDEX `UQE_library_element_org_id_folder_id_name_kind` ON `library_element` (`org_id`,`folder_id`,`name`,`kind`);
-- create library_element_connection table v1
CREATE TABLE IF NOT EXISTS `library_element_connection` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `element_id` INTEGER NOT NULL , `kind` INTEGER NOT NULL , `connection_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `created_by` INTEGER NOT NULL );
-- add index library_element_connection element_id-kind-connection_id
CREATE UNIQUE INDEX `UQE_library_element_connection_element_id_kind_connection_id` ON `library_element_connection` (`element_id`,`kind`,`connection_id`);
