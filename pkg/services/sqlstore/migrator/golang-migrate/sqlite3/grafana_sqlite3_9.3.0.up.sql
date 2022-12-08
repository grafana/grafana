-- Add preferences index org_id
CREATE INDEX `IDX_preferences_org_id` ON `preferences` (`org_id`);
-- Add preferences index user_id
CREATE INDEX `IDX_preferences_user_id` ON `preferences` (`user_id`);
-- add correlation config column
ALTER TABLE `correlation` ADD COLUMN `config` TEXT NULL;
-- add annotations_enabled column
ALTER TABLE `dashboard_public` ADD COLUMN `annotations_enabled` INTEGER NOT NULL DEFAULT 0;
-- add action column to seed_assignment
ALTER TABLE `seed_assignment` ADD COLUMN `action` TEXT NULL;
-- add scope column to seed_assignment
ALTER TABLE `seed_assignment` ADD COLUMN `scope` TEXT NULL;
-- remove unique index builtin_role_role_name before nullable update
DROP INDEX `UQE_seed_assignment_builtin_role_role_name`;
-- update seed_assignment role_name column to nullable
ALTER TABLE seed_assignment ADD COLUMN tmp_role_name VARCHAR(190) DEFAULT NULL; UPDATE seed_assignment SET tmp_role_name = role_name; ALTER TABLE seed_assignment DROP COLUMN role_name; ALTER TABLE seed_assignment RENAME COLUMN tmp_role_name TO role_name;
-- add unique index builtin_role_name back
CREATE UNIQUE INDEX `UQE_seed_assignment_builtin_role_role_name` ON `seed_assignment` (`builtin_role`,`role_name`);
-- add unique index builtin_role_action_scope
CREATE UNIQUE INDEX `UQE_seed_assignment_builtin_role_action_scope` ON `seed_assignment` (`builtin_role`,`action`,`scope`);
