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
-- Dumping data for table `secret_migration_log`
--

INSERT INTO `secret_migration_log` (`migration_id`, `sql`, `success`, `error`, `timestamp`) VALUES
  ('create secret_migration_log table','CREATE TABLE IF NOT EXISTS `secret_migration_log` (\n`id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL\n, `migration_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `sql` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `success` TINYINT(1) NOT NULL\n, `error` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `timestamp` DATETIME NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('Initialize secrets tables','',1,'','2022-01-01 00:00:00'),
  ('drop table secret_secure_value','DROP TABLE IF EXISTS `secret_secure_value`',1,'','2022-01-01 00:00:00'),
  ('create table secret_secure_value','CREATE TABLE IF NOT EXISTS `secret_secure_value` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `annotations` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `labels` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `created` BIGINT(20) NOT NULL\n, `created_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `updated` BIGINT(20) NOT NULL\n, `updated_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `external_id` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `active` TINYINT(1) NOT NULL\n, `version` BIGINT(20) NOT NULL\n, `description` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `keeper` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `decrypters` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `ref` VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table secret_secure_value, index: 0','CREATE UNIQUE INDEX `UQE_secret_secure_value_namespace_name_version_active` ON `secret_secure_value` (`namespace`,`name`,`version`,`active`);',1,'','2022-01-01 00:00:00'),
  ('create table secret_secure_value, index: 1','CREATE UNIQUE INDEX `UQE_secret_secure_value_namespace_name_version` ON `secret_secure_value` (`namespace`,`name`,`version`);',1,'','2022-01-01 00:00:00'),
  ('drop table secret_keeper','DROP TABLE IF EXISTS `secret_keeper`',1,'','2022-01-01 00:00:00'),
  ('create table secret_keeper','CREATE TABLE IF NOT EXISTS `secret_keeper` (\n`guid` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `annotations` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `labels` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n, `created` BIGINT(20) NOT NULL\n, `created_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `updated` BIGINT(20) NOT NULL\n, `updated_by` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `description` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `type` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `payload` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table secret_keeper, index: 0','CREATE UNIQUE INDEX `UQE_secret_keeper_namespace_name` ON `secret_keeper` (`namespace`,`name`);',1,'','2022-01-01 00:00:00'),
  ('drop table secret_data_key','DROP TABLE IF EXISTS `secret_data_key`',1,'','2022-01-01 00:00:00'),
  ('create table secret_data_key','CREATE TABLE IF NOT EXISTS `secret_data_key` (\n`uid` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL\n, `namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `label` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `active` TINYINT(1) NOT NULL\n, `provider` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `encrypted_data` BLOB NOT NULL\n, `created` DATETIME NOT NULL\n, `updated` DATETIME NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('drop table secret_encrypted_value','DROP TABLE IF EXISTS `secret_encrypted_value`',1,'','2022-01-01 00:00:00'),
  ('create table secret_encrypted_value','CREATE TABLE IF NOT EXISTS `secret_encrypted_value` (\n`namespace` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL\n, `version` BIGINT(20) NOT NULL\n, `encrypted_data` BLOB NOT NULL\n, `created` BIGINT(20) NOT NULL\n, `updated` BIGINT(20) NOT NULL\n) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;',1,'','2022-01-01 00:00:00'),
  ('create table secret_encrypted_value, index: 0','CREATE UNIQUE INDEX `UQE_secret_encrypted_value_namespace_name_version` ON `secret_encrypted_value` (`namespace`,`name`,`version`);',1,'','2022-01-01 00:00:00'),
  ('create index for list on secret_secure_value','CREATE INDEX `IDX_secret_secure_value_namespace_active_updated` ON `secret_secure_value` (`namespace`,`active`,`updated`);',1,'','2022-01-01 00:00:00'),
  ('create index for list and read current on secret_data_key','CREATE INDEX `IDX_secret_data_key_namespace_label_active` ON `secret_data_key` (`namespace`,`label`,`active`);',1,'','2022-01-01 00:00:00'),
  ('add owner_reference_api_group column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_api_group` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  ('add owner_reference_api_version column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_api_version` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  ('add owner_reference_kind column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_kind` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  ('add owner_reference_name column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `owner_reference_name` VARCHAR(253) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  ('add lease_token column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `lease_token` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL ',1,'','2022-01-01 00:00:00'),
  ('add lease_token index to secret_secure_value','CREATE INDEX `IDX_secret_secure_value_lease_token` ON `secret_secure_value` (`lease_token`);',1,'','2022-01-01 00:00:00'),
  ('add lease_created column to secret_secure_value','alter table `secret_secure_value` ADD COLUMN `lease_created` BIGINT(20) NOT NULL DEFAULT 0 ',1,'','2022-01-01 00:00:00'),
  ('add lease_created index to secret_secure_value','CREATE INDEX `IDX_secret_secure_value_lease_created` ON `secret_secure_value` (`lease_created`);',1,'','2022-01-01 00:00:00'),
  ('add data_key_id column to secret_encrypted_value','alter table `secret_encrypted_value` ADD COLUMN `data_key_id` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT \'\' ',1,'','2022-01-01 00:00:00'),
  ('add data_key_id index to secret_encrypted_value','CREATE INDEX `IDX_secret_encrypted_value_data_key_id` ON `secret_encrypted_value` (`data_key_id`);',1,'','2022-01-01 00:00:00'),
  ('add active column to secret_keeper','alter table `secret_keeper` ADD COLUMN `active` TINYINT(1) NOT NULL DEFAULT 0 ',1,'','2022-01-01 00:00:00'),
  ('add active column index to secret_keeper','CREATE INDEX `IDX_secret_keeper_namespace_name_active` ON `secret_keeper` (`namespace`,`name`,`active`);',1,'','2022-01-01 00:00:00'),
  ('set secret_secure_value.keeper to \'system\' where keeper is null in secret_secure_value','UPDATE secret_secure_value SET keeper = \'system\' WHERE keeper IS NULL',1,'','2022-01-01 00:00:00'),
  ('drop my_row_id and add primary key with columns namespace,name,version to table secret_encrypted_value if my_row_id exists (auto-generated mysql column)','\n	  ALTER TABLE secret_encrypted_value\n	  DROP PRIMARY KEY,\n	  DROP COLUMN my_row_id,\n	  DROP INDEX UQE_secret_encrypted_value_namespace_name_version,\n	  ADD PRIMARY KEY (`namespace`,`name`,`version`);\n	',1,'','2022-01-01 00:00:00'),
  ('drop unique index UQE_secret_encrypted_value_namespace_name_version from secret_encrypted_value table if it exists (mysql)','ALTER TABLE secret_encrypted_value DROP INDEX UQE_secret_encrypted_value_namespace_name_version',1,'','2022-01-01 00:00:00'),
  ('add primary key with columns namespace,name,version to table secret_encrypted_value if it doesn\'t exist (mysql)','ALTER TABLE secret_encrypted_value ADD PRIMARY KEY (`namespace`,`name`,`version`)',1,'','2022-01-01 00:00:00'),
  ('add primary key with columns namespace,name,version to table secret_encrypted_value (postgres and sqlite)','',1,'','2022-01-01 00:00:00');
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

