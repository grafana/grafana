-- Add is_service_account column to user
ALTER TABLE `user` ADD COLUMN `is_service_account` INTEGER NOT NULL DEFAULT 0
-- Add service account foreign key
ALTER TABLE `api_key` ADD COLUMN `service_account_id` INTEGER NULL
-- Add column week_start in preferences
ALTER TABLE `preferences` ADD COLUMN `week_start` TEXT NULL
-- create data_keys table
CREATE TABLE IF NOT EXISTS `data_keys` ( `name` TEXT PRIMARY KEY NOT NULL , `active` INTEGER NOT NULL , `scope` TEXT NOT NULL , `provider` TEXT NOT NULL , `encrypted_data` BLOB NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- create permission table
CREATE TABLE IF NOT EXISTS `permission` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `role_id` INTEGER NOT NULL , `action` TEXT NOT NULL , `scope` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add unique index permission.role_id
CREATE INDEX `IDX_permission_role_id` ON `permission` (`role_id`);
-- add unique index role_id_action_scope
CREATE UNIQUE INDEX `UQE_permission_role_id_action_scope` ON `permission` (`role_id`,`action`,`scope`);
-- create role table
CREATE TABLE IF NOT EXISTS `role` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `name` TEXT NOT NULL , `description` TEXT NULL , `version` INTEGER NOT NULL , `org_id` INTEGER NOT NULL , `uid` TEXT NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add column display_name
ALTER TABLE `role` ADD COLUMN `display_name` TEXT NULL
-- add column group_name
ALTER TABLE `role` ADD COLUMN `group_name` TEXT NULL
-- add index role.org_id
CREATE INDEX `IDX_role_org_id` ON `role` (`org_id`);
-- add unique index role_org_id_name
CREATE UNIQUE INDEX `UQE_role_org_id_name` ON `role` (`org_id`,`name`);
-- add index role_org_id_uid
CREATE UNIQUE INDEX `UQE_role_org_id_uid` ON `role` (`org_id`,`uid`);
-- create team role table
CREATE TABLE IF NOT EXISTS `team_role` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `team_id` INTEGER NOT NULL , `role_id` INTEGER NOT NULL , `created` DATETIME NOT NULL );
-- add index team_role.org_id
CREATE INDEX `IDX_team_role_org_id` ON `team_role` (`org_id`);
-- add unique index team_role_org_id_team_id_role_id
CREATE UNIQUE INDEX `UQE_team_role_org_id_team_id_role_id` ON `team_role` (`org_id`,`team_id`,`role_id`);
-- add index team_role.team_id
CREATE INDEX `IDX_team_role_team_id` ON `team_role` (`team_id`);
-- create user role table
CREATE TABLE IF NOT EXISTS `user_role` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `user_id` INTEGER NOT NULL , `role_id` INTEGER NOT NULL , `created` DATETIME NOT NULL );
-- add index user_role.org_id
CREATE INDEX `IDX_user_role_org_id` ON `user_role` (`org_id`);
-- add unique index user_role_org_id_user_id_role_id
CREATE UNIQUE INDEX `UQE_user_role_org_id_user_id_role_id` ON `user_role` (`org_id`,`user_id`,`role_id`);
-- add index user_role.user_id
CREATE INDEX `IDX_user_role_user_id` ON `user_role` (`user_id`);
-- create builtin role table
CREATE TABLE IF NOT EXISTS `builtin_role` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `role` TEXT NOT NULL , `role_id` INTEGER NOT NULL , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- add index builtin_role.role_id
CREATE INDEX `IDX_builtin_role_role_id` ON `builtin_role` (`role_id`);
-- add index builtin_role.name
CREATE INDEX `IDX_builtin_role_role` ON `builtin_role` (`role`);
-- Add column org_id to builtin_role table
ALTER TABLE `builtin_role` ADD COLUMN `org_id` INTEGER NOT NULL DEFAULT 0
-- add index builtin_role.org_id
CREATE INDEX `IDX_builtin_role_org_id` ON `builtin_role` (`org_id`);
-- add unique index builtin_role_org_id_role_id_role
CREATE UNIQUE INDEX `UQE_builtin_role_org_id_role_id_role` ON `builtin_role` (`org_id`,`role_id`,`role`);
-- Remove unique index role_org_id_uid
DROP INDEX `UQE_role_org_id_uid`
-- add unique index role.uid
CREATE UNIQUE INDEX `UQE_role_uid` ON `role` (`uid`);
-- create seed assignment table
CREATE TABLE IF NOT EXISTS `seed_assignment` ( `builtin_role` TEXT NOT NULL , `role_name` TEXT NOT NULL );
-- add unique index builtin_role_role_name
CREATE UNIQUE INDEX `UQE_seed_assignment_builtin_role_role_name` ON `seed_assignment` (`builtin_role`,`role_name`);
