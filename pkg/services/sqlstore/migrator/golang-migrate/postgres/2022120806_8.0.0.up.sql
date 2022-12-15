-- Add revoked_at to the user auth token
alter table "user_auth_token" ADD COLUMN "revoked_at" INTEGER NULL
-- delete alert_definition table
DROP TABLE IF EXISTS "alert_definition"
-- recreate alert_definition table
CREATE TABLE IF NOT EXISTS "alert_definition" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "title" VARCHAR(190) NOT NULL , "condition" VARCHAR(190) NOT NULL , "data" TEXT NOT NULL , "updated" TIMESTAMP NOT NULL , "interval_seconds" BIGINT NOT NULL DEFAULT 60 , "version" INTEGER NOT NULL DEFAULT 0 , "uid" VARCHAR(40) NOT NULL DEFAULT 0 );
-- add index in alert_definition on org_id and title columns
CREATE INDEX "IDX_alert_definition_org_id_title" ON "alert_definition" ("org_id","title");
-- add index in alert_definition on org_id and uid columns
CREATE INDEX "IDX_alert_definition_org_id_uid" ON "alert_definition" ("org_id","uid");
-- alter alert_definition table data column to mediumtext in mysql
SELECT 0;
-- drop index in alert_definition on org_id and title columns
DROP INDEX "IDX_alert_definition_org_id_title" CASCADE
-- drop index in alert_definition on org_id and uid columns
DROP INDEX "IDX_alert_definition_org_id_uid" CASCADE
-- add unique index in alert_definition on org_id and title columns
CREATE UNIQUE INDEX "UQE_alert_definition_org_id_title" ON "alert_definition" ("org_id","title");
-- add unique index in alert_definition on org_id and uid columns
CREATE UNIQUE INDEX "UQE_alert_definition_org_id_uid" ON "alert_definition" ("org_id","uid");
-- Add column paused in alert_definition
alter table "alert_definition" ADD COLUMN "paused" BOOL NOT NULL DEFAULT FALSE
-- drop alert_definition table
DROP TABLE IF EXISTS "alert_definition"
-- delete alert_definition_version table
DROP TABLE IF EXISTS "alert_definition_version"
-- recreate alert_definition_version table
CREATE TABLE IF NOT EXISTS "alert_definition_version" ( "id" SERIAL PRIMARY KEY  NOT NULL , "alert_definition_id" BIGINT NOT NULL , "alert_definition_uid" VARCHAR(40) NOT NULL DEFAULT 0 , "parent_version" INTEGER NOT NULL , "restored_from" INTEGER NOT NULL , "version" INTEGER NOT NULL , "created" TIMESTAMP NOT NULL , "title" VARCHAR(190) NOT NULL , "condition" VARCHAR(190) NOT NULL , "data" TEXT NOT NULL , "interval_seconds" BIGINT NOT NULL );
-- add index in alert_definition_version table on alert_definition_id and version columns
CREATE UNIQUE INDEX "UQE_alert_definition_version_alert_definition_id_version" ON "alert_definition_version" ("alert_definition_id","version");
-- add index in alert_definition_version table on alert_definition_uid and version columns
CREATE UNIQUE INDEX "UQE_alert_definition_version_alert_definition_uid_version" ON "alert_definition_version" ("alert_definition_uid","version");
-- alter alert_definition_version table data column to mediumtext in mysql
SELECT 0;
-- drop alert_definition_version table
DROP TABLE IF EXISTS "alert_definition_version"
-- create alert_instance table
CREATE TABLE IF NOT EXISTS "alert_instance" ( "def_org_id" BIGINT NOT NULL , "def_uid" VARCHAR(40) NOT NULL DEFAULT 0 , "labels" TEXT NOT NULL , "labels_hash" VARCHAR(190) NOT NULL , "current_state" VARCHAR(190) NOT NULL , "current_state_since" BIGINT NOT NULL , "last_eval_time" BIGINT NOT NULL , PRIMARY KEY ( "def_org_id","def_uid","labels_hash" ));
-- add index in alert_instance table on def_org_id, def_uid and current_state columns
CREATE INDEX "IDX_alert_instance_def_org_id_def_uid_current_state" ON "alert_instance" ("def_org_id","def_uid","current_state");
-- add index in alert_instance table on def_org_id, current_state columns
CREATE INDEX "IDX_alert_instance_def_org_id_current_state" ON "alert_instance" ("def_org_id","current_state");
-- add column current_state_end to alert_instance
alter table "alert_instance" ADD COLUMN "current_state_end" BIGINT NOT NULL DEFAULT 0
-- remove index def_org_id, def_uid, current_state on alert_instance
DROP INDEX "IDX_alert_instance_def_org_id_def_uid_current_state" CASCADE
-- remove index def_org_id, current_state on alert_instance
DROP INDEX "IDX_alert_instance_def_org_id_current_state" CASCADE
-- rename def_org_id to rule_org_id in alert_instance
ALTER TABLE alert_instance RENAME COLUMN def_org_id TO rule_org_id;
-- rename def_uid to rule_uid in alert_instance
ALTER TABLE alert_instance RENAME COLUMN def_uid TO rule_uid;
-- add index rule_org_id, rule_uid, current_state on alert_instance
CREATE INDEX "IDX_alert_instance_rule_org_id_rule_uid_current_state" ON "alert_instance" ("rule_org_id","rule_uid","current_state");
-- add index rule_org_id, current_state on alert_instance
CREATE INDEX "IDX_alert_instance_rule_org_id_current_state" ON "alert_instance" ("rule_org_id","current_state");
-- create alert_rule table
CREATE TABLE IF NOT EXISTS "alert_rule" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "title" VARCHAR(190) NOT NULL , "condition" VARCHAR(190) NOT NULL , "data" TEXT NOT NULL , "updated" TIMESTAMP NOT NULL , "interval_seconds" BIGINT NOT NULL DEFAULT 60 , "version" INTEGER NOT NULL DEFAULT 0 , "uid" VARCHAR(40) NOT NULL DEFAULT 0 , "namespace_uid" VARCHAR(40) NOT NULL , "rule_group" VARCHAR(190) NOT NULL , "no_data_state" VARCHAR(15) NOT NULL DEFAULT 'NoData' , "exec_err_state" VARCHAR(15) NOT NULL DEFAULT 'Alerting' );
-- add index in alert_rule on org_id and title columns
CREATE UNIQUE INDEX "UQE_alert_rule_org_id_title" ON "alert_rule" ("org_id","title");
-- add index in alert_rule on org_id and uid columns
CREATE UNIQUE INDEX "UQE_alert_rule_org_id_uid" ON "alert_rule" ("org_id","uid");
-- add index in alert_rule on org_id, namespace_uid, group_uid columns
CREATE INDEX "IDX_alert_rule_org_id_namespace_uid_rule_group" ON "alert_rule" ("org_id","namespace_uid","rule_group");
-- alter alert_rule table data column to mediumtext in mysql
SELECT 0;
-- add column for to alert_rule
alter table "alert_rule" ADD COLUMN "for" BIGINT NOT NULL DEFAULT 0
-- add column annotations to alert_rule
alter table "alert_rule" ADD COLUMN "annotations" TEXT NULL
-- add column labels to alert_rule
alter table "alert_rule" ADD COLUMN "labels" TEXT NULL
-- remove unique index from alert_rule on org_id, title columns
DROP INDEX "UQE_alert_rule_org_id_title" CASCADE
-- add index in alert_rule on org_id, namespase_uid and title columns
CREATE UNIQUE INDEX "UQE_alert_rule_org_id_namespace_uid_title" ON "alert_rule" ("org_id","namespace_uid","title");
-- create alert_rule_version table
CREATE TABLE IF NOT EXISTS "alert_rule_version" ( "id" SERIAL PRIMARY KEY  NOT NULL , "rule_org_id" BIGINT NOT NULL , "rule_uid" VARCHAR(40) NOT NULL DEFAULT 0 , "rule_namespace_uid" VARCHAR(40) NOT NULL , "rule_group" VARCHAR(190) NOT NULL , "parent_version" INTEGER NOT NULL , "restored_from" INTEGER NOT NULL , "version" INTEGER NOT NULL , "created" TIMESTAMP NOT NULL , "title" VARCHAR(190) NOT NULL , "condition" VARCHAR(190) NOT NULL , "data" TEXT NOT NULL , "interval_seconds" BIGINT NOT NULL , "no_data_state" VARCHAR(15) NOT NULL DEFAULT 'NoData' , "exec_err_state" VARCHAR(15) NOT NULL DEFAULT 'Alerting' );
-- add index in alert_rule_version table on rule_org_id, rule_uid and version columns
CREATE UNIQUE INDEX "UQE_alert_rule_version_rule_org_id_rule_uid_version" ON "alert_rule_version" ("rule_org_id","rule_uid","version");
-- add index in alert_rule_version table on rule_org_id, rule_namespace_uid and rule_group columns
CREATE INDEX "IDX_alert_rule_version_rule_org_id_rule_namespace_uid_rule_group" ON "alert_rule_version" ("rule_org_id","rule_namespace_uid","rule_group");
-- alter alert_rule_version table data column to mediumtext in mysql
SELECT 0;
-- add column for to alert_rule_version
alter table "alert_rule_version" ADD COLUMN "for" BIGINT NOT NULL DEFAULT 0
-- add column annotations to alert_rule_version
alter table "alert_rule_version" ADD COLUMN "annotations" TEXT NULL
-- add column labels to alert_rule_version
alter table "alert_rule_version" ADD COLUMN "labels" TEXT NULL
-- create_alert_configuration_table
CREATE TABLE IF NOT EXISTS "alert_configuration" ( "id" SERIAL PRIMARY KEY  NOT NULL , "alertmanager_configuration" TEXT NOT NULL , "configuration_version" VARCHAR(3) NOT NULL , "created_at" INTEGER NOT NULL );
-- Add column default in alert_configuration
alter table "alert_configuration" ADD COLUMN "default" BOOL NOT NULL DEFAULT FALSE
-- create library_element table v1
CREATE TABLE IF NOT EXISTS "library_element" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "folder_id" BIGINT NOT NULL , "uid" VARCHAR(40) NOT NULL , "name" VARCHAR(150) NOT NULL , "kind" BIGINT NOT NULL , "type" VARCHAR(40) NOT NULL , "description" VARCHAR(255) NOT NULL , "model" TEXT NOT NULL , "created" TIMESTAMP NOT NULL , "created_by" BIGINT NOT NULL , "updated" TIMESTAMP NOT NULL , "updated_by" BIGINT NOT NULL , "version" BIGINT NOT NULL );
-- add index library_element org_id-folder_id-name-kind
CREATE UNIQUE INDEX "UQE_library_element_org_id_folder_id_name_kind" ON "library_element" ("org_id","folder_id","name","kind");
-- create library_element_connection table v1
CREATE TABLE IF NOT EXISTS "library_element_connection" ( "id" SERIAL PRIMARY KEY  NOT NULL , "element_id" BIGINT NOT NULL , "kind" BIGINT NOT NULL , "connection_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "created_by" BIGINT NOT NULL );
-- add index library_element_connection element_id-kind-connection_id
CREATE UNIQUE INDEX "UQE_library_element_connection_element_id_kind_connection_id" ON "library_element_connection" ("element_id","kind","connection_id");
