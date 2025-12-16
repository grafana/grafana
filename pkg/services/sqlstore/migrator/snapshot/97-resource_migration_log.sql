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
-- Dumping data for table `resource_migration_log`
--

INSERT INTO `resource_migration_log` (`migration_id`, `sql`, `success`, `error`, `timestamp`) VALUES
  ('create resource_migration_log table','CREATE TABLE IF NOT EXISTS `resource_migration_log` (\n`id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL\n, `migration_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `sql` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `success` TINYINT(1) NOT NULL\n, `error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `timestamp` DATETIME NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('Initialize resource tables','',1,'','2022-01-01 00:00:00'),
  ('drop table resource','DROP TABLE IF EXISTS `resource`',1,'','2022-01-01 00:00:00'),
  ('create table resource','CREATE TABLE IF NOT EXISTS `resource` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `resource_version` BIGINT(20) NULL\n, `group` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(63) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `value` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `action` INT NOT NULL\n, `label_set` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table resource, index: 0','CREATE UNIQUE INDEX `UQE_resource_namespace_group_resource_name` ON `resource` (`namespace`,`group`,`resource`,`name`);',1,'','2022-01-01 00:00:00'),
  ('drop table resource_history','DROP TABLE IF EXISTS `resource_history`',1,'','2022-01-01 00:00:00'),
  ('create table resource_history','CREATE TABLE IF NOT EXISTS `resource_history` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `resource_version` BIGINT(20) NULL\n, `group` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(63) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `value` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `action` INT NOT NULL\n, `label_set` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table resource_history, index: 0','CREATE UNIQUE INDEX `UQE_resource_history_namespace_group_name_version` ON `resource_history` (`namespace`,`group`,`resource`,`name`,`resource_version`);',1,'','2022-01-01 00:00:00'),
  ('create table resource_history, index: 1','CREATE INDEX `IDX_resource_history_resource_version` ON `resource_history` (`resource_version`);',1,'','2022-01-01 00:00:00'),
  ('drop table resource_version','DROP TABLE IF EXISTS `resource_version`',1,'','2022-01-01 00:00:00'),
  ('create table resource_version','CREATE TABLE IF NOT EXISTS `resource_version` (\n`group` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource_version` BIGINT(20) NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table resource_version, index: 0','CREATE UNIQUE INDEX `UQE_resource_version_group_resource` ON `resource_version` (`group`,`resource`);',1,'','2022-01-01 00:00:00'),
  ('drop table resource_blob','DROP TABLE IF EXISTS `resource_blob`',1,'','2022-01-01 00:00:00'),
  ('create table resource_blob','CREATE TABLE IF NOT EXISTS `resource_blob` (\n`uuid` CHAR(36) PRIMARY KEY NOT NULL\n, `created` DATETIME NOT NULL\n, `group` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(63) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `value` LONGBLOB NOT NULL\n, `hash` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `content_type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table resource_blob, index: 0','CREATE INDEX `IDX_resource_history_namespace_group_name` ON `resource_blob` (`namespace`,`group`,`resource`,`name`);',1,'','2022-01-01 00:00:00'),
  ('create table resource_blob, index: 1','CREATE INDEX `IDX_resource_blob_created` ON `resource_blob` (`created`);',1,'','2022-01-01 00:00:00'),
  ('drop table resource_last_import_time','DROP TABLE IF EXISTS `resource_last_import_time`',1,'','2022-01-01 00:00:00'),
  ('create table resource_last_import_time','CREATE TABLE IF NOT EXISTS `resource_last_import_time` (\n`group` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `resource` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(63) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `last_import_time` DATETIME NOT NULL\n, PRIMARY KEY ( `group`,`resource`,`namespace` )) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('Add column previous_resource_version in resource_history','alter table `resource_history` ADD COLUMN `previous_resource_version` BIGINT(20) NULL ',1,'','2022-01-01 00:00:00'),
  ('Add column previous_resource_version in resource','alter table `resource` ADD COLUMN `previous_resource_version` BIGINT(20) NULL ',1,'','2022-01-01 00:00:00'),
  ('Add index to resource_history for polling','CREATE INDEX `IDX_resource_history_group_resource_resource_version` ON `resource_history` (`group`,`resource`,`resource_version`);',1,'','2022-01-01 00:00:00'),
  ('Add index to resource for loading','CREATE INDEX `IDX_resource_group_resource` ON `resource` (`group`,`resource`);',1,'','2022-01-01 00:00:00'),
  ('Add column folder in resource_history','alter table `resource_history` ADD COLUMN `folder` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'\' ',1,'','2022-01-01 00:00:00'),
  ('Add column folder in resource','alter table `resource` ADD COLUMN `folder` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'\' ',1,'','2022-01-01 00:00:00'),
  ('Migrate DeletionMarkers to real Resource objects','Find rows in resource_history with value LIKE {\"kind\":\"DeletedMarker\"%',1,'','2022-01-01 00:00:00'),
  ('Add index to resource_history for get trash','CREATE INDEX `IDX_resource_history_namespace_group_resource_action_version` ON `resource_history` (`namespace`,`group`,`resource`,`action`,`resource_version`);',1,'','2022-01-01 00:00:00'),
  ('Add generation to resource history','alter table `resource_history` ADD COLUMN `generation` BIGINT(20) NOT NULL DEFAULT 0 ',1,'','2022-01-01 00:00:00'),
  ('Add generation index to resource history','CREATE INDEX `IDX_resource_history_namespace_group_resource_name_generation` ON `resource_history` (`namespace`,`group`,`resource`,`name`,`generation`);',1,'','2022-01-01 00:00:00'),
  ('Add UQE_resource_last_import_time_last_import_time index','CREATE INDEX `UQE_resource_last_import_time_last_import_time` ON `resource_last_import_time` (`last_import_time`);',1,'','2022-01-01 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

