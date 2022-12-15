-- add index kv_store.org_id-namespace-key
CREATE UNIQUE INDEX "UQE_kv_store_org_id_namespace_key" ON "kv_store" ("org_id","namespace","key");
-- Add is_service_account column to user
alter table "user" ADD COLUMN "is_service_account" BOOL NOT NULL DEFAULT FALSE
-- Add service account foreign key
alter table "api_key" ADD COLUMN "service_account_id" BIGINT NULL
-- Add column week_start in preferences
alter table "preferences" ADD COLUMN "week_start" VARCHAR(10) NULL
-- create data_keys table
CREATE TABLE IF NOT EXISTS "data_keys" ( "name" VARCHAR(100) PRIMARY KEY NOT NULL , "active" BOOL NOT NULL , "scope" VARCHAR(30) NOT NULL , "provider" VARCHAR(50) NOT NULL , "encrypted_data" BYTEA NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- update dashboard_uid and panel_id from existing annotations
set dashboard_uid and panel_id migration
-- create permission table
CREATE TABLE IF NOT EXISTS "permission" ( "id" SERIAL PRIMARY KEY  NOT NULL , "role_id" BIGINT NOT NULL , "action" VARCHAR(190) NOT NULL , "scope" VARCHAR(190) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add unique index permission.role_id
CREATE INDEX "IDX_permission_role_id" ON "permission" ("role_id");
-- add unique index role_id_action_scope
CREATE UNIQUE INDEX "UQE_permission_role_id_action_scope" ON "permission" ("role_id","action","scope");
-- create role table
CREATE TABLE IF NOT EXISTS "role" ( "id" SERIAL PRIMARY KEY  NOT NULL , "name" VARCHAR(190) NOT NULL , "description" TEXT NULL , "version" BIGINT NOT NULL , "org_id" BIGINT NOT NULL , "uid" VARCHAR(40) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add column display_name
alter table "role" ADD COLUMN "display_name" VARCHAR(190) NULL
-- add column group_name
alter table "role" ADD COLUMN "group_name" VARCHAR(190) NULL
-- add index role.org_id
CREATE INDEX "IDX_role_org_id" ON "role" ("org_id");
-- add unique index role_org_id_name
CREATE UNIQUE INDEX "UQE_role_org_id_name" ON "role" ("org_id","name");
-- add index role_org_id_uid
CREATE UNIQUE INDEX "UQE_role_org_id_uid" ON "role" ("org_id","uid");
-- create team role table
CREATE TABLE IF NOT EXISTS "team_role" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "team_id" BIGINT NOT NULL , "role_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL );
-- add index team_role.org_id
CREATE INDEX "IDX_team_role_org_id" ON "team_role" ("org_id");
-- add unique index team_role_org_id_team_id_role_id
CREATE UNIQUE INDEX "UQE_team_role_org_id_team_id_role_id" ON "team_role" ("org_id","team_id","role_id");
-- add index team_role.team_id
CREATE INDEX "IDX_team_role_team_id" ON "team_role" ("team_id");
-- create user role table
CREATE TABLE IF NOT EXISTS "user_role" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "user_id" BIGINT NOT NULL , "role_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL );
-- add index user_role.org_id
CREATE INDEX "IDX_user_role_org_id" ON "user_role" ("org_id");
-- add unique index user_role_org_id_user_id_role_id
CREATE UNIQUE INDEX "UQE_user_role_org_id_user_id_role_id" ON "user_role" ("org_id","user_id","role_id");
-- add index user_role.user_id
CREATE INDEX "IDX_user_role_user_id" ON "user_role" ("user_id");
-- create builtin role table
CREATE TABLE IF NOT EXISTS "builtin_role" ( "id" SERIAL PRIMARY KEY  NOT NULL , "role" VARCHAR(190) NOT NULL , "role_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index builtin_role.role_id
CREATE INDEX "IDX_builtin_role_role_id" ON "builtin_role" ("role_id");
-- add index builtin_role.name
CREATE INDEX "IDX_builtin_role_role" ON "builtin_role" ("role");
-- Add column org_id to builtin_role table
alter table "builtin_role" ADD COLUMN "org_id" BIGINT NOT NULL DEFAULT 0
-- add index builtin_role.org_id
CREATE INDEX "IDX_builtin_role_org_id" ON "builtin_role" ("org_id");
-- add unique index builtin_role_org_id_role_id_role
CREATE UNIQUE INDEX "UQE_builtin_role_org_id_role_id_role" ON "builtin_role" ("org_id","role_id","role");
-- Remove unique index role_org_id_uid
DROP INDEX "UQE_role_org_id_uid" CASCADE
-- add unique index role.uid
CREATE UNIQUE INDEX "UQE_role_uid" ON "role" ("uid");
-- create seed assignment table
CREATE TABLE IF NOT EXISTS "seed_assignment" ( "builtin_role" VARCHAR(190) NOT NULL , "role_name" VARCHAR(190) NOT NULL );
-- add unique index builtin_role_role_name
CREATE UNIQUE INDEX "UQE_seed_assignment_builtin_role_role_name" ON "seed_assignment" ("builtin_role","role_name");
