-- Add is_service_account column to user
alter table `user` ADD COLUMN `is_service_account` TINYINT(1) NOT NULL DEFAULT 0
-- Add service account foreign key
alter table `api_key` ADD COLUMN `service_account_id` BIGINT(20) NULL
-- Add column week_start in preferences
alter table `preferences` ADD COLUMN `week_start` VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- create data_keys table
CREATE TABLE IF NOT EXISTS `data_keys` ( `name` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY NOT NULL , `active` TINYINT(1) NOT NULL , `scope` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `provider` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `encrypted_data` BLOB NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- update dashboard_uid and panel_id from existing annotations
set dashboard_uid and panel_id migration
-- create permission table
CREATE TABLE IF NOT EXISTS `permission` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `role_id` BIGINT(20) NOT NULL , `action` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `scope` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index permission.role_id
CREATE INDEX `IDX_permission_role_id` ON `permission` (`role_id`);
-- add unique index role_id_action_scope
CREATE UNIQUE INDEX `UQE_permission_role_id_action_scope` ON `permission` (`role_id`,`action`,`scope`);
-- create role table
CREATE TABLE IF NOT EXISTS `role` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `description` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL , `version` BIGINT(20) NOT NULL , `org_id` BIGINT(20) NOT NULL , `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add column display_name
alter table `role` ADD COLUMN `display_name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- add column group_name
alter table `role` ADD COLUMN `group_name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- add index role.org_id
CREATE INDEX `IDX_role_org_id` ON `role` (`org_id`);
-- add unique index role_org_id_name
CREATE UNIQUE INDEX `UQE_role_org_id_name` ON `role` (`org_id`,`name`);
-- add index role_org_id_uid
CREATE UNIQUE INDEX `UQE_role_org_id_uid` ON `role` (`org_id`,`uid`);
-- create team role table
CREATE TABLE IF NOT EXISTS `team_role` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `team_id` BIGINT(20) NOT NULL , `role_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index team_role.org_id
CREATE INDEX `IDX_team_role_org_id` ON `team_role` (`org_id`);
-- add unique index team_role_org_id_team_id_role_id
CREATE UNIQUE INDEX `UQE_team_role_org_id_team_id_role_id` ON `team_role` (`org_id`,`team_id`,`role_id`);
-- add index team_role.team_id
CREATE INDEX `IDX_team_role_team_id` ON `team_role` (`team_id`);
-- create user role table
CREATE TABLE IF NOT EXISTS `user_role` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `user_id` BIGINT(20) NOT NULL , `role_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index user_role.org_id
CREATE INDEX `IDX_user_role_org_id` ON `user_role` (`org_id`);
-- add unique index user_role_org_id_user_id_role_id
CREATE UNIQUE INDEX `UQE_user_role_org_id_user_id_role_id` ON `user_role` (`org_id`,`user_id`,`role_id`);
-- add index user_role.user_id
CREATE INDEX `IDX_user_role_user_id` ON `user_role` (`user_id`);
-- create builtin role table
CREATE TABLE IF NOT EXISTS `builtin_role` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `role` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `role_id` BIGINT(20) NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index builtin_role.role_id
CREATE INDEX `IDX_builtin_role_role_id` ON `builtin_role` (`role_id`);
-- add index builtin_role.name
CREATE INDEX `IDX_builtin_role_role` ON `builtin_role` (`role`);
-- Add column org_id to builtin_role table
alter table `builtin_role` ADD COLUMN `org_id` BIGINT(20) NOT NULL DEFAULT 0
-- add index builtin_role.org_id
CREATE INDEX `IDX_builtin_role_org_id` ON `builtin_role` (`org_id`);
-- add unique index builtin_role_org_id_role_id_role
CREATE UNIQUE INDEX `UQE_builtin_role_org_id_role_id_role` ON `builtin_role` (`org_id`,`role_id`,`role`);
-- Remove unique index role_org_id_uid
DROP INDEX `UQE_role_org_id_uid` ON `role`
-- add unique index role.uid
CREATE UNIQUE INDEX `UQE_role_uid` ON `role` (`uid`);
-- create seed assignment table
CREATE TABLE IF NOT EXISTS `seed_assignment` ( `builtin_role` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `role_name` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add unique index builtin_role_role_name
CREATE UNIQUE INDEX `UQE_seed_assignment_builtin_role_role_name` ON `seed_assignment` (`builtin_role`,`role_name`);
