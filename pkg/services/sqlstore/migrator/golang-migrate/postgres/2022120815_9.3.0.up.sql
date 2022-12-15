-- Add preferences index org_id
CREATE INDEX "IDX_preferences_org_id" ON "preferences" ("org_id");
-- Add preferences index user_id
CREATE INDEX "IDX_preferences_user_id" ON "preferences" ("user_id");
-- add correlation config column
alter table "correlation" ADD COLUMN "config" TEXT NULL
-- add annotations_enabled column
alter table "dashboard_public" ADD COLUMN "annotations_enabled" BOOL NOT NULL DEFAULT FALSE
-- add action column to seed_assignment
alter table "seed_assignment" ADD COLUMN "action" VARCHAR(190) NULL
-- add scope column to seed_assignment
alter table "seed_assignment" ADD COLUMN "scope" VARCHAR(190) NULL
-- remove unique index builtin_role_role_name before nullable update
DROP INDEX "UQE_seed_assignment_builtin_role_role_name" CASCADE
-- update seed_assignment role_name column to nullable
ALTER TABLE `seed_assignment` ALTER COLUMN role_name DROP NOT NULL;
-- add unique index builtin_role_name back
CREATE UNIQUE INDEX "UQE_seed_assignment_builtin_role_role_name" ON "seed_assignment" ("builtin_role","role_name");
-- add unique index builtin_role_action_scope
CREATE UNIQUE INDEX "UQE_seed_assignment_builtin_role_action_scope" ON "seed_assignment" ("builtin_role","action","scope");
-- migrate external alertmanagers to datsourcse
migrate external alertmanagers to datasource
