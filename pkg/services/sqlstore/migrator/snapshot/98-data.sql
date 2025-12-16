-- MySQL dump 10.13  Distrib 8.4.5, for Linux (x86_64)
--
-- Host: localhost    Database: hg_dump
-- ------------------------------------------------------
-- Server version	8.4.5
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `alert`
--


--
-- Dumping data for table `alert_image`
--


--
-- Dumping data for table `alert_instance`
--


--
-- Dumping data for table `alert_notification`
--


--
-- Dumping data for table `alert_notification_state`
--


--
-- Dumping data for table `alert_rule`
--


--
-- Dumping data for table `alert_rule_state`
--


--
-- Dumping data for table `alert_rule_tag`
--


--
-- Dumping data for table `alert_rule_version`
--


--
-- Dumping data for table `annotation`
--


--
-- Dumping data for table `annotation_tag`
--


--
-- Dumping data for table `anon_device`
--


--
-- Dumping data for table `api_key`
--


--
-- Dumping data for table `cache_data`
--


--
-- Dumping data for table `cloud_migration_resource`
--


--
-- Dumping data for table `cloud_migration_session`
--


--
-- Dumping data for table `cloud_migration_snapshot`
--


--
-- Dumping data for table `cloud_migration_snapshot_partition`
--


--
-- Dumping data for table `correlation`
--


--
-- Dumping data for table `dashboard`
--


--
-- Dumping data for table `dashboard_acl`
--

INSERT INTO `dashboard_acl` (`id`, `org_id`, `dashboard_id`, `user_id`, `team_id`, `permission`, `role`, `created`, `updated`) VALUES
  (1,-1,-1,NULL,NULL,1,'Viewer','2022-01-01 00:00:00','2022-01-01 00:00:00'),
  (2,-1,-1,NULL,NULL,2,'Editor','2022-01-01 00:00:00','2022-01-01 00:00:00');

--
-- Dumping data for table `dashboard_provisioning`
--


--
-- Dumping data for table `dashboard_public`
--


--
-- Dumping data for table `dashboard_public_email_share`
--


--
-- Dumping data for table `dashboard_public_magic_link`
--


--
-- Dumping data for table `dashboard_public_session`
--


--
-- Dumping data for table `dashboard_public_usage_by_day`
--


--
-- Dumping data for table `dashboard_snapshot`
--


--
-- Dumping data for table `dashboard_tag`
--


--
-- Dumping data for table `dashboard_usage_by_day`
--


--
-- Dumping data for table `dashboard_usage_sums`
--


--
-- Dumping data for table `dashboard_version`
--


--
-- Dumping data for table `data_keys`
--


--
-- Dumping data for table `data_source`
--


--
-- Dumping data for table `data_source_acl`
--


--
-- Dumping data for table `data_source_cache`
--


--
-- Dumping data for table `data_source_usage_by_day`
--


--
-- Dumping data for table `entity_event`
--


--
-- Dumping data for table `file`
--


--
-- Dumping data for table `file_meta`
--


--
-- Dumping data for table `folder`
--


--
-- Dumping data for table `library_element`
--


--
-- Dumping data for table `library_element_connection`
--


--
-- Dumping data for table `license_token`
--


--
-- Dumping data for table `login_attempt`
--


--
-- Dumping data for table `ngalert_configuration`
--


--
-- Dumping data for table `playlist`
--


--
-- Dumping data for table `playlist_item`
--


--
-- Dumping data for table `plugin_setting`
--


--
-- Dumping data for table `preferences`
--


--
-- Dumping data for table `provenance_type`
--


--
-- Dumping data for table `query_history`
--


--
-- Dumping data for table `query_history_details`
--


--
-- Dumping data for table `query_history_star`
--


--
-- Dumping data for table `quota`
--


--
-- Dumping data for table `recording_rules`
--


--
-- Dumping data for table `remote_write_targets`
--


--
-- Dumping data for table `report`
--


--
-- Dumping data for table `report_dashboards`
--


--
-- Dumping data for table `report_settings`
--


--
-- Dumping data for table `resource`
--


--
-- Dumping data for table `resource_blob`
--


--
-- Dumping data for table `resource_history`
--


--
-- Dumping data for table `resource_last_import_time`
--


--
-- Dumping data for table `resource_version`
--


--
-- Dumping data for table `secret_data_key`
--


--
-- Dumping data for table `secret_encrypted_value`
--


--
-- Dumping data for table `secret_keeper`
--


--
-- Dumping data for table `secret_migration_log`
--

INSERT INTO `secret_migration_log` (`id`, `migration_id`, `sql`, `success`, `error`, `timestamp`) VALUES
  (1,'create secret_migration_log table','CREATE TABLE IF NOT EXISTS `secret_migration_log` (\n`id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL\n, `migration_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `sql` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `success` TINYINT(1) NOT NULL\n, `error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `timestamp` DATETIME NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  (2,'Initialize secrets tables','',1,'','2022-01-01 00:00:00'),
  (3,'drop table secret_secure_value','DROP TABLE IF EXISTS `secret_secure_value`',1,'','2022-01-01 00:00:00'),
  (4,'create table secret_secure_value','CREATE TABLE IF NOT EXISTS `secret_secure_value` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `annotations` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `labels` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `created` BIGINT(20) NOT NULL\n, `created_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `updated` BIGINT(20) NOT NULL\n, `updated_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `external_id` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `active` TINYINT(1) NOT NULL\n, `version` BIGINT(20) NOT NULL\n, `description` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `keeper` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `decrypters` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `ref` VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  (5,'create table secret_secure_value, index: 0','CREATE UNIQUE INDEX `UQE_secret_secure_value_namespace_name_version_active` ON `secret_secure_value` (`namespace`,`name`,`version`,`active`);',1,'','2022-01-01 00:00:00'),
  (6,'create table secret_secure_value, index: 1','CREATE UNIQUE INDEX `UQE_secret_secure_value_namespace_name_version` ON `secret_secure_value` (`namespace`,`name`,`version`);',1,'','2022-01-01 00:00:00'),
  (7,'drop table secret_keeper','DROP TABLE IF EXISTS `secret_keeper`',1,'','2022-01-01 00:00:00'),
  (8,'create table secret_keeper','CREATE TABLE IF NOT EXISTS `secret_keeper` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `annotations` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `labels` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `created` BIGINT(20) NOT NULL\n, `created_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `updated` BIGINT(20) NOT NULL\n, `updated_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `description` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `type` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `payload` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  (9,'create table secret_keeper, index: 0','CREATE UNIQUE INDEX `UQE_secret_keeper_namespace_name` ON `secret_keeper` (`namespace`,`name`);',1,'','2022-01-01 00:00:00'),
  (10,'drop table secret_data_key','DROP TABLE IF EXISTS `secret_data_key`',1,'','2022-01-01 00:00:00'),
  (11,'create table secret_data_key','CREATE TABLE IF NOT EXISTS `secret_data_key` (\n`uid` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `label` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `active` TINYINT(1) NOT NULL\n, `provider` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `encrypted_data` BLOB NOT NULL\n, `created` DATETIME NOT NULL\n, `updated` DATETIME NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  (12,'drop table secret_encrypted_value','DROP TABLE IF EXISTS `secret_encrypted_value`',1,'','2022-01-01 00:00:00'),
  (13,'create table secret_encrypted_value','CREATE TABLE IF NOT EXISTS `secret_encrypted_value` (\n`namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `version` BIGINT(20) NOT NULL\n, `encrypted_data` BLOB NOT NULL\n, `created` BIGINT(20) NOT NULL\n, `updated` BIGINT(20) NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  (14,'create table secret_encrypted_value, index: 0','CREATE UNIQUE INDEX `UQE_secret_encrypted_value_namespace_name_version` ON `secret_encrypted_value` (`namespace`,`name`,`version`);',1,'','2022-01-01 00:00:00'),
  (15,'create index for list on secret_secure_value','CREATE INDEX `IDX_secret_secure_value_namespace_active_updated` ON `secret_secure_value` (`namespace`,`active`,`updated`);',1,'','2022-01-01 00:00:00'),
  (16,'create index for list and read current on secret_data_key','CREATE INDEX `IDX_secret_data_key_namespace_label_active` ON `secret_data_key` (`namespace`,`label`,`active`);',1,'','2022-01-01 00:00:00'),
  (17,'add owner_reference_api_group column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_api_group` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  (18,'add owner_reference_api_version column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_api_version` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  (19,'add owner_reference_kind column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_kind` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  (20,'add owner_reference_name column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  (21,'add lease_token column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `lease_token` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  (22,'add lease_token index to secret_secure_value','CREATE INDEX `IDX_secret_secure_value_lease_token` ON `secret_secure_value` (`lease_token`);',1,'','2022-01-01 00:00:00'),
  (23,'add lease_created column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `lease_created` BIGINT(20) NOT NULL DEFAULT 0 ',1,'','2022-01-01 00:00:00'),
  (24,'add lease_created index to secret_secure_value','CREATE INDEX `IDX_secret_secure_value_lease_created` ON `secret_secure_value` (`lease_created`);',1,'','2022-01-01 00:00:00');

--
-- Dumping data for table `secret_secure_value`
--


--
-- Dumping data for table `secrets`
--


--
-- Dumping data for table `session`
--


--
-- Dumping data for table `setting`
--


--
-- Dumping data for table `short_url`
--


--
-- Dumping data for table `signing_key`
--


--
-- Dumping data for table `sso_setting`
--


--
-- Dumping data for table `star`
--


--
-- Dumping data for table `tag`
--


--
-- Dumping data for table `team`
--


--
-- Dumping data for table `team_group`
--


--
-- Dumping data for table `team_member`
--


--
-- Dumping data for table `team_role`
--


--
-- Dumping data for table `temp_user`
--


--
-- Dumping data for table `test_data`
--


--
-- Dumping data for table `user_auth`
--


--
-- Dumping data for table `user_auth_token`
--


--
-- Dumping data for table `user_dashboard_views`
--


--
-- Dumping data for table `user_external_session`
--


--
-- Dumping data for table `user_role`
--


--
-- Dumping data for table `user_stats`
--

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

