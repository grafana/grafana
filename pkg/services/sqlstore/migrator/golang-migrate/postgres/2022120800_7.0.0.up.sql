-- create migration_log table
CREATE TABLE IF NOT EXISTS "migration_log" ( "id" SERIAL PRIMARY KEY  NOT NULL , "migration_id" VARCHAR(255) NOT NULL , "sql" TEXT NOT NULL , "success" BOOL NOT NULL , "error" TEXT NOT NULL , "timestamp" TIMESTAMP NOT NULL );
-- create user table
CREATE TABLE IF NOT EXISTS "user" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" INTEGER NOT NULL , "login" VARCHAR(190) NOT NULL , "email" VARCHAR(190) NOT NULL , "name" VARCHAR(255) NULL , "password" VARCHAR(255) NULL , "salt" VARCHAR(50) NULL , "rands" VARCHAR(50) NULL , "company" VARCHAR(255) NULL , "account_id" BIGINT NOT NULL , "is_admin" BOOL NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add unique index user.login
CREATE UNIQUE INDEX "UQE_user_login" ON "user" ("login");
-- add unique index user.email
CREATE UNIQUE INDEX "UQE_user_email" ON "user" ("email");
-- drop index UQE_user_login - v1
DROP INDEX "UQE_user_login" CASCADE
-- drop index UQE_user_email - v1
DROP INDEX "UQE_user_email" CASCADE
-- Rename table user to user_v1 - v1
ALTER TABLE "user" RENAME TO "user_v1"
-- create user table v2
CREATE TABLE IF NOT EXISTS "user" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" INTEGER NOT NULL , "login" VARCHAR(190) NOT NULL , "email" VARCHAR(190) NOT NULL , "name" VARCHAR(255) NULL , "password" VARCHAR(255) NULL , "salt" VARCHAR(50) NULL , "rands" VARCHAR(50) NULL , "company" VARCHAR(255) NULL , "org_id" BIGINT NOT NULL , "is_admin" BOOL NOT NULL , "email_verified" BOOL NULL , "theme" VARCHAR(255) NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index UQE_user_login - v2
CREATE UNIQUE INDEX "UQE_user_login" ON "user" ("login");
-- create index UQE_user_email - v2
CREATE UNIQUE INDEX "UQE_user_email" ON "user" ("email");
-- copy data_source v1 to v2
INSERT INTO "user" ("updated" , "id" , "version" , "password" , "salt" , "rands" , "is_admin" , "created" , "login" , "email" , "name" , "company" , "org_id") SELECT "updated" , "id" , "version" , "password" , "salt" , "rands" , "is_admin" , "created" , "login" , "email" , "name" , "company" , "account_id" FROM "user_v1"
-- Drop old table user_v1
DROP TABLE IF EXISTS "user_v1"
-- Add column help_flags1 to user table
alter table "user" ADD COLUMN "help_flags1" BIGINT NOT NULL DEFAULT 0
-- Update user table charset
ALTER TABLE "user" ALTER "login" TYPE VARCHAR(190), ALTER "email" TYPE VARCHAR(190), ALTER "name" TYPE VARCHAR(255), ALTER "password" TYPE VARCHAR(255), ALTER "salt" TYPE VARCHAR(50), ALTER "rands" TYPE VARCHAR(50), ALTER "company" TYPE VARCHAR(255), ALTER "theme" TYPE VARCHAR(255);
-- Add last_seen_at column to user
alter table "user" ADD COLUMN "last_seen_at" TIMESTAMP NULL
-- Add is_disabled column to user
alter table "user" ADD COLUMN "is_disabled" BOOL NOT NULL DEFAULT FALSE
-- Add index user.login/user.email
CREATE INDEX "IDX_user_login_email" ON "user" ("login","email");
-- create temp user table v1-7
CREATE TABLE IF NOT EXISTS "temp_user" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "version" INTEGER NOT NULL , "email" VARCHAR(190) NOT NULL , "name" VARCHAR(255) NULL , "role" VARCHAR(20) NULL , "code" VARCHAR(190) NOT NULL , "status" VARCHAR(20) NOT NULL , "invited_by_user_id" BIGINT NULL , "email_sent" BOOL NOT NULL , "email_sent_on" TIMESTAMP NULL , "remote_addr" VARCHAR(255) NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index IDX_temp_user_email - v1-7
CREATE INDEX "IDX_temp_user_email" ON "temp_user" ("email");
-- create index IDX_temp_user_org_id - v1-7
CREATE INDEX "IDX_temp_user_org_id" ON "temp_user" ("org_id");
-- create index IDX_temp_user_code - v1-7
CREATE INDEX "IDX_temp_user_code" ON "temp_user" ("code");
-- create index IDX_temp_user_status - v1-7
CREATE INDEX "IDX_temp_user_status" ON "temp_user" ("status");
-- Update temp_user table charset
ALTER TABLE "temp_user" ALTER "email" TYPE VARCHAR(190), ALTER "name" TYPE VARCHAR(255), ALTER "role" TYPE VARCHAR(20), ALTER "code" TYPE VARCHAR(190), ALTER "status" TYPE VARCHAR(20), ALTER "remote_addr" TYPE VARCHAR(255);
-- create star table
CREATE TABLE IF NOT EXISTS "star" ( "id" SERIAL PRIMARY KEY  NOT NULL , "user_id" BIGINT NOT NULL , "dashboard_id" BIGINT NOT NULL );
-- add unique index star.user_id_dashboard_id
CREATE UNIQUE INDEX "UQE_star_user_id_dashboard_id" ON "star" ("user_id","dashboard_id");
-- create org table v1
CREATE TABLE IF NOT EXISTS "org" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" INTEGER NOT NULL , "name" VARCHAR(190) NOT NULL , "address1" VARCHAR(255) NULL , "address2" VARCHAR(255) NULL , "city" VARCHAR(255) NULL , "state" VARCHAR(255) NULL , "zip_code" VARCHAR(50) NULL , "country" VARCHAR(255) NULL , "billing_email" VARCHAR(255) NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index UQE_org_name - v1
CREATE UNIQUE INDEX "UQE_org_name" ON "org" ("name");
-- create org_user table v1
CREATE TABLE IF NOT EXISTS "org_user" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "user_id" BIGINT NOT NULL , "role" VARCHAR(20) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index IDX_org_user_org_id - v1
CREATE INDEX "IDX_org_user_org_id" ON "org_user" ("org_id");
-- create index UQE_org_user_org_id_user_id - v1
CREATE UNIQUE INDEX "UQE_org_user_org_id_user_id" ON "org_user" ("org_id","user_id");
-- Update org table charset
ALTER TABLE "org" ALTER "name" TYPE VARCHAR(190), ALTER "address1" TYPE VARCHAR(255), ALTER "address2" TYPE VARCHAR(255), ALTER "city" TYPE VARCHAR(255), ALTER "state" TYPE VARCHAR(255), ALTER "zip_code" TYPE VARCHAR(50), ALTER "country" TYPE VARCHAR(255), ALTER "billing_email" TYPE VARCHAR(255);
-- Update org_user table charset
ALTER TABLE "org_user" ALTER "role" TYPE VARCHAR(20);
-- Migrate all Read Only Viewers to Viewers
UPDATE org_user SET role = 'Viewer' WHERE role = 'Read Only Editor'
-- create dashboard table
CREATE TABLE IF NOT EXISTS "dashboard" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" INTEGER NOT NULL , "slug" VARCHAR(189) NOT NULL , "title" VARCHAR(255) NOT NULL , "data" TEXT NOT NULL , "account_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index dashboard.account_id
CREATE INDEX "IDX_dashboard_account_id" ON "dashboard" ("account_id");
-- Rename table data_source to data_source_v1 - v1
ALTER TABLE "data_source" RENAME TO "data_source_v1"
-- add unique index dashboard_account_id_slug
CREATE UNIQUE INDEX "UQE_dashboard_account_id_slug" ON "dashboard" ("account_id","slug");
-- create dashboard_tag table
CREATE TABLE IF NOT EXISTS "dashboard_tag" ( "id" SERIAL PRIMARY KEY  NOT NULL , "dashboard_id" BIGINT NOT NULL , "term" VARCHAR(50) NOT NULL );
-- add unique index dashboard_tag.dasboard_id_term
CREATE UNIQUE INDEX "UQE_dashboard_tag_dashboard_id_term" ON "dashboard_tag" ("dashboard_id","term");
-- drop index UQE_dashboard_tag_dashboard_id_term - v1
DROP INDEX "UQE_dashboard_tag_dashboard_id_term" CASCADE
-- Rename table dashboard to dashboard_v1 - v1
ALTER TABLE "dashboard" RENAME TO "dashboard_v1"
-- create dashboard v2
CREATE TABLE IF NOT EXISTS "dashboard" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" INTEGER NOT NULL , "slug" VARCHAR(189) NOT NULL , "title" VARCHAR(255) NOT NULL , "data" TEXT NOT NULL , "org_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index IDX_dashboard_org_id - v2
CREATE INDEX "IDX_dashboard_org_id" ON "dashboard" ("org_id");
-- create index UQE_dashboard_org_id_slug - v2
CREATE UNIQUE INDEX "UQE_dashboard_org_id_slug" ON "dashboard" ("org_id","slug");
-- copy dashboard v1 to v2
INSERT INTO "dashboard" ("version" , "slug" , "title" , "data" , "org_id" , "created" , "updated" , "id") SELECT "version" , "slug" , "title" , "data" , "account_id" , "created" , "updated" , "id" FROM "dashboard_v1"
-- drop table dashboard_v1
DROP TABLE IF EXISTS "dashboard_v1"
-- alter dashboard.data to mediumtext v1
SELECT 0;
-- Add column updated_by in dashboard - v2
alter table "dashboard" ADD COLUMN "updated_by" INTEGER NULL
-- Add column created_by in dashboard - v2
alter table "dashboard" ADD COLUMN "created_by" INTEGER NULL
-- Add column gnetId in dashboard
alter table "dashboard" ADD COLUMN "gnet_id" BIGINT NULL
-- Add index for gnetId in dashboard
CREATE INDEX "IDX_dashboard_gnet_id" ON "dashboard" ("gnet_id");
-- Add column plugin_id in dashboard
alter table "dashboard" ADD COLUMN "plugin_id" VARCHAR(189) NULL
-- Add index for plugin_id in dashboard
CREATE INDEX "IDX_dashboard_org_id_plugin_id" ON "dashboard" ("org_id","plugin_id");
-- Add index for dashboard_id in dashboard_tag
CREATE INDEX "IDX_dashboard_tag_dashboard_id" ON "dashboard_tag" ("dashboard_id");
-- Update dashboard table charset
ALTER TABLE "dashboard" ALTER "slug" TYPE VARCHAR(189), ALTER "title" TYPE VARCHAR(255), ALTER "plugin_id" TYPE VARCHAR(189), ALTER "data" TYPE TEXT;
-- Update dashboard_tag table charset
ALTER TABLE "dashboard_tag" ALTER "term" TYPE VARCHAR(50);
-- Add column folder_id in dashboard
alter table "dashboard" ADD COLUMN "folder_id" BIGINT NOT NULL DEFAULT 0
-- Add column isFolder in dashboard
alter table "dashboard" ADD COLUMN "is_folder" BOOL NOT NULL DEFAULT FALSE
-- Add column has_acl in dashboard
alter table "dashboard" ADD COLUMN "has_acl" BOOL NOT NULL DEFAULT FALSE
-- Add column uid in dashboard
alter table "dashboard" ADD COLUMN "uid" VARCHAR(40) NULL
-- Update uid column values in dashboard
UPDATE dashboard SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;
-- Add unique index dashboard_org_id_uid
CREATE UNIQUE INDEX "UQE_dashboard_org_id_uid" ON "dashboard" ("org_id","uid");
-- Remove unique index org_id_slug
DROP INDEX "UQE_dashboard_org_id_slug" CASCADE
-- Update dashboard title length
ALTER TABLE "dashboard" ALTER "title" TYPE VARCHAR(189);
-- Add unique index for dashboard_org_id_title_folder_id
CREATE UNIQUE INDEX "UQE_dashboard_org_id_folder_id_title" ON "dashboard" ("org_id","folder_id","title");
-- create dashboard_provisioning
CREATE TABLE IF NOT EXISTS "dashboard_provisioning" ( "id" SERIAL PRIMARY KEY  NOT NULL , "dashboard_id" BIGINT NULL , "name" VARCHAR(150) NOT NULL , "external_id" TEXT NOT NULL , "updated" TIMESTAMP NOT NULL );
-- Rename table dashboard_provisioning to dashboard_provisioning_tmp_qwerty - v1
ALTER TABLE "dashboard_provisioning" RENAME TO "dashboard_provisioning_tmp_qwerty"
-- create dashboard_provisioning v2
CREATE TABLE IF NOT EXISTS "dashboard_provisioning" ( "id" SERIAL PRIMARY KEY  NOT NULL , "dashboard_id" BIGINT NULL , "name" VARCHAR(150) NOT NULL , "external_id" TEXT NOT NULL , "updated" INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_dashboard_provisioning_dashboard_id - v2
CREATE INDEX "IDX_dashboard_provisioning_dashboard_id" ON "dashboard_provisioning" ("dashboard_id");
-- create index IDX_dashboard_provisioning_dashboard_id_name - v2
CREATE INDEX "IDX_dashboard_provisioning_dashboard_id_name" ON "dashboard_provisioning" ("dashboard_id","name");
-- copy dashboard_provisioning v1 to v2
INSERT INTO "dashboard_provisioning" ("id" , "dashboard_id" , "name" , "external_id") SELECT "id" , "dashboard_id" , "name" , "external_id" FROM "dashboard_provisioning_tmp_qwerty"
-- drop dashboard_provisioning_tmp_qwerty
DROP TABLE IF EXISTS "dashboard_provisioning_tmp_qwerty"
-- Add check_sum column
alter table "dashboard_provisioning" ADD COLUMN "check_sum" VARCHAR(32) NULL
-- Add index for dashboard_title
CREATE INDEX "IDX_dashboard_title" ON "dashboard" ("title");
-- create data_source table
CREATE TABLE IF NOT EXISTS "data_source" ( "id" SERIAL PRIMARY KEY  NOT NULL , "account_id" BIGINT NOT NULL , "version" INTEGER NOT NULL , "type" VARCHAR(255) NOT NULL , "name" VARCHAR(190) NOT NULL , "access" VARCHAR(255) NOT NULL , "url" VARCHAR(255) NOT NULL , "password" VARCHAR(255) NULL , "user" VARCHAR(255) NULL , "database" VARCHAR(255) NULL , "basic_auth" BOOL NOT NULL , "basic_auth_user" VARCHAR(255) NULL , "basic_auth_password" VARCHAR(255) NULL , "is_default" BOOL NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index data_source.account_id
CREATE INDEX "IDX_data_source_account_id" ON "data_source" ("account_id");
-- add unique index data_source.account_id_name
CREATE UNIQUE INDEX "UQE_data_source_account_id_name" ON "data_source" ("account_id","name");
-- drop index IDX_data_source_account_id - v1
DROP INDEX "IDX_data_source_account_id" CASCADE
-- drop index UQE_data_source_account_id_name - v1
DROP INDEX "UQE_data_source_account_id_name" CASCADE
-- create data_source table v2
CREATE TABLE IF NOT EXISTS "data_source" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "version" INTEGER NOT NULL , "type" VARCHAR(255) NOT NULL , "name" VARCHAR(190) NOT NULL , "access" VARCHAR(255) NOT NULL , "url" VARCHAR(255) NOT NULL , "password" VARCHAR(255) NULL , "user" VARCHAR(255) NULL , "database" VARCHAR(255) NULL , "basic_auth" BOOL NOT NULL , "basic_auth_user" VARCHAR(255) NULL , "basic_auth_password" VARCHAR(255) NULL , "is_default" BOOL NOT NULL , "json_data" TEXT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index IDX_data_source_org_id - v2
CREATE INDEX "IDX_data_source_org_id" ON "data_source" ("org_id");
-- create index UQE_data_source_org_id_name - v2
CREATE UNIQUE INDEX "UQE_data_source_org_id_name" ON "data_source" ("org_id","name");
-- copy data_source v1 to v2
INSERT INTO "data_source" ("password" , "basic_auth" , "updated" , "id" , "org_id" , "version" , "name" , "access" , "user" , "basic_auth_password" , "url" , "created" , "type" , "database" , "basic_auth_user" , "is_default") SELECT "password" , "basic_auth" , "updated" , "id" , "account_id" , "version" , "name" , "access" , "user" , "basic_auth_password" , "url" , "created" , "type" , "database" , "basic_auth_user" , "is_default" FROM "data_source_v1"
-- Drop old table data_source_v1 #2
DROP TABLE IF EXISTS "data_source_v1"
-- Add column with_credentials
alter table "data_source" ADD COLUMN "with_credentials" BOOL NOT NULL DEFAULT FALSE
-- Add secure json data column
alter table "data_source" ADD COLUMN "secure_json_data" TEXT NULL
-- Update data_source table charset
ALTER TABLE "data_source" ALTER "type" TYPE VARCHAR(255), ALTER "name" TYPE VARCHAR(190), ALTER "access" TYPE VARCHAR(255), ALTER "url" TYPE VARCHAR(255), ALTER "password" TYPE VARCHAR(255), ALTER "user" TYPE VARCHAR(255), ALTER "database" TYPE VARCHAR(255), ALTER "basic_auth_user" TYPE VARCHAR(255), ALTER "basic_auth_password" TYPE VARCHAR(255), ALTER "json_data" TYPE TEXT, ALTER "secure_json_data" TYPE TEXT;
-- Update initial version to 1
UPDATE data_source SET version = 1 WHERE version = 0
-- Add read_only data column
alter table "data_source" ADD COLUMN "read_only" BOOL NULL
-- Migrate logging ds to loki ds
UPDATE data_source SET type = 'loki' WHERE type = 'logging'
-- Update json_data with nulls
UPDATE data_source SET json_data = '{}' WHERE json_data is null
-- Add uid column
alter table "data_source" ADD COLUMN "uid" VARCHAR(40) NOT NULL DEFAULT 0
-- Update uid value
UPDATE data_source SET uid=lpad('' || id::text,9,'0');
-- Add unique index datasource_org_id_uid
CREATE UNIQUE INDEX "UQE_data_source_org_id_uid" ON "data_source" ("org_id","uid");
-- create api_key table
CREATE TABLE IF NOT EXISTS "api_key" ( "id" SERIAL PRIMARY KEY  NOT NULL , "account_id" BIGINT NOT NULL , "name" VARCHAR(190) NOT NULL , "key" VARCHAR(64) NOT NULL , "role" VARCHAR(255) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index api_key.account_id
CREATE INDEX "IDX_api_key_account_id" ON "api_key" ("account_id");
-- add index api_key.key
CREATE UNIQUE INDEX "UQE_api_key_key" ON "api_key" ("key");
-- add index api_key.account_id_name
CREATE UNIQUE INDEX "UQE_api_key_account_id_name" ON "api_key" ("account_id","name");
-- drop index IDX_api_key_account_id - v1
DROP INDEX "IDX_api_key_account_id" CASCADE
-- drop index UQE_api_key_key - v1
DROP INDEX "UQE_api_key_key" CASCADE
-- drop index UQE_api_key_account_id_name - v1
DROP INDEX "UQE_api_key_account_id_name" CASCADE
-- Rename table api_key to api_key_v1 - v1
ALTER TABLE "api_key" RENAME TO "api_key_v1"
-- create api_key table v2
CREATE TABLE IF NOT EXISTS "api_key" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "name" VARCHAR(190) NOT NULL , "key" VARCHAR(190) NOT NULL , "role" VARCHAR(255) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index IDX_api_key_org_id - v2
CREATE INDEX "IDX_api_key_org_id" ON "api_key" ("org_id");
-- create index UQE_api_key_key - v2
CREATE UNIQUE INDEX "UQE_api_key_key" ON "api_key" ("key");
-- create index UQE_api_key_org_id_name - v2
CREATE UNIQUE INDEX "UQE_api_key_org_id_name" ON "api_key" ("org_id","name");
-- copy api_key v1 to v2
INSERT INTO "api_key" ("key" , "role" , "created" , "updated" , "id" , "org_id" , "name") SELECT "key" , "role" , "created" , "updated" , "id" , "account_id" , "name" FROM "api_key_v1"
-- Drop old table api_key_v1
DROP TABLE IF EXISTS "api_key_v1"
-- Update api_key table charset
ALTER TABLE "api_key" ALTER "name" TYPE VARCHAR(190), ALTER "key" TYPE VARCHAR(190), ALTER "role" TYPE VARCHAR(255);
-- Add expires to api_key table
alter table "api_key" ADD COLUMN "expires" BIGINT NULL
-- create dashboard_snapshot table v4
CREATE TABLE IF NOT EXISTS "dashboard_snapshot" ( "id" SERIAL PRIMARY KEY  NOT NULL , "name" VARCHAR(255) NOT NULL , "key" VARCHAR(190) NOT NULL , "dashboard" TEXT NOT NULL , "expires" TIMESTAMP NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- drop table dashboard_snapshot_v4 #1
DROP TABLE IF EXISTS "dashboard_snapshot"
-- create dashboard_snapshot table v5 #2
CREATE TABLE IF NOT EXISTS "dashboard_snapshot" ( "id" SERIAL PRIMARY KEY  NOT NULL , "name" VARCHAR(255) NOT NULL , "key" VARCHAR(190) NOT NULL , "delete_key" VARCHAR(190) NOT NULL , "org_id" BIGINT NOT NULL , "user_id" BIGINT NOT NULL , "external" BOOL NOT NULL , "external_url" VARCHAR(255) NOT NULL , "dashboard" TEXT NOT NULL , "expires" TIMESTAMP NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index UQE_dashboard_snapshot_key - v5
CREATE UNIQUE INDEX "UQE_dashboard_snapshot_key" ON "dashboard_snapshot" ("key");
-- create index UQE_dashboard_snapshot_delete_key - v5
CREATE UNIQUE INDEX "UQE_dashboard_snapshot_delete_key" ON "dashboard_snapshot" ("delete_key");
-- create index IDX_dashboard_snapshot_user_id - v5
CREATE INDEX "IDX_dashboard_snapshot_user_id" ON "dashboard_snapshot" ("user_id");
-- alter dashboard_snapshot to mediumtext v2
SELECT 0;
-- Update dashboard_snapshot table charset
ALTER TABLE "dashboard_snapshot" ALTER "name" TYPE VARCHAR(255), ALTER "key" TYPE VARCHAR(190), ALTER "delete_key" TYPE VARCHAR(190), ALTER "external_url" TYPE VARCHAR(255), ALTER "dashboard" TYPE TEXT;
-- Add column external_delete_url to dashboard_snapshots table
alter table "dashboard_snapshot" ADD COLUMN "external_delete_url" VARCHAR(255) NULL
-- create quota table v1
CREATE TABLE IF NOT EXISTS "quota" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NULL , "user_id" BIGINT NULL , "target" VARCHAR(190) NOT NULL , "limit" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index UQE_quota_org_id_user_id_target - v1
CREATE UNIQUE INDEX "UQE_quota_org_id_user_id_target" ON "quota" ("org_id","user_id","target");
-- Update quota table charset
ALTER TABLE "quota" ALTER "target" TYPE VARCHAR(190);
-- create plugin_setting table
CREATE TABLE IF NOT EXISTS "plugin_setting" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NULL , "plugin_id" VARCHAR(190) NOT NULL , "enabled" BOOL NOT NULL , "pinned" BOOL NOT NULL , "json_data" TEXT NULL , "secure_json_data" TEXT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- create index UQE_plugin_setting_org_id_plugin_id - v1
CREATE UNIQUE INDEX "UQE_plugin_setting_org_id_plugin_id" ON "plugin_setting" ("org_id","plugin_id");
-- Add column plugin_version to plugin_settings
alter table "plugin_setting" ADD COLUMN "plugin_version" VARCHAR(50) NULL
-- Update plugin_setting table charset
ALTER TABLE "plugin_setting" ALTER "plugin_id" TYPE VARCHAR(190), ALTER "json_data" TYPE TEXT, ALTER "secure_json_data" TYPE TEXT, ALTER "plugin_version" TYPE VARCHAR(50);
-- create session table
CREATE TABLE IF NOT EXISTS "session" ( "key" CHAR(16) PRIMARY KEY NOT NULL , "data" BYTEA NOT NULL , "expiry" INTEGER NOT NULL );
-- Drop old table playlist table
DROP TABLE IF EXISTS "playlist"
-- Drop old table playlist_item table
DROP TABLE IF EXISTS "playlist_item"
-- create playlist table v2
CREATE TABLE IF NOT EXISTS "playlist" ( "id" SERIAL PRIMARY KEY  NOT NULL , "name" VARCHAR(255) NOT NULL , "interval" VARCHAR(255) NOT NULL , "org_id" BIGINT NOT NULL );
-- create playlist item table v2
CREATE TABLE IF NOT EXISTS "playlist_item" ( "id" SERIAL PRIMARY KEY  NOT NULL , "playlist_id" BIGINT NOT NULL , "type" VARCHAR(255) NOT NULL , "value" TEXT NOT NULL , "title" TEXT NOT NULL , "order" INTEGER NOT NULL );
-- Update playlist table charset
ALTER TABLE "playlist" ALTER "name" TYPE VARCHAR(255), ALTER "interval" TYPE VARCHAR(255);
-- Update playlist_item table charset
ALTER TABLE "playlist_item" ALTER "type" TYPE VARCHAR(255), ALTER "value" TYPE TEXT, ALTER "title" TYPE TEXT;
-- drop preferences table v2
DROP TABLE IF EXISTS "preferences"
-- drop preferences table v3
DROP TABLE IF EXISTS "preferences"
-- create preferences table v3
CREATE TABLE IF NOT EXISTS "preferences" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "user_id" BIGINT NOT NULL , "version" INTEGER NOT NULL , "home_dashboard_id" BIGINT NOT NULL , "timezone" VARCHAR(50) NOT NULL , "theme" VARCHAR(20) NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- Update preferences table charset
ALTER TABLE "preferences" ALTER "timezone" TYPE VARCHAR(50), ALTER "theme" TYPE VARCHAR(20);
-- Add column team_id in preferences
alter table "preferences" ADD COLUMN "team_id" BIGINT NULL
-- Update team_id column values in preferences
UPDATE preferences SET team_id=0 WHERE team_id IS NULL;
-- create alert table v1
CREATE TABLE IF NOT EXISTS "alert" ( "id" SERIAL PRIMARY KEY  NOT NULL , "version" BIGINT NOT NULL , "dashboard_id" BIGINT NOT NULL , "panel_id" BIGINT NOT NULL , "org_id" BIGINT NOT NULL , "name" VARCHAR(255) NOT NULL , "message" TEXT NOT NULL , "state" VARCHAR(190) NOT NULL , "settings" TEXT NOT NULL , "frequency" BIGINT NOT NULL , "handler" BIGINT NOT NULL , "severity" TEXT NOT NULL , "silenced" BOOL NOT NULL , "execution_error" TEXT NOT NULL , "eval_data" TEXT NULL , "eval_date" TIMESTAMP NULL , "new_state_date" TIMESTAMP NOT NULL , "state_changes" INTEGER NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index alert org_id & id 
CREATE INDEX "IDX_alert_org_id_id" ON "alert" ("org_id","id");
-- add index alert state
CREATE INDEX "IDX_alert_state" ON "alert" ("state");
-- add index alert dashboard_id
CREATE INDEX "IDX_alert_dashboard_id" ON "alert" ("dashboard_id");
-- Create alert_rule_tag table v1
CREATE TABLE IF NOT EXISTS "alert_rule_tag" ( "alert_id" BIGINT NOT NULL , "tag_id" BIGINT NOT NULL );
-- Add unique index alert_rule_tag.alert_id_tag_id
CREATE UNIQUE INDEX "UQE_alert_rule_tag_alert_id_tag_id" ON "alert_rule_tag" ("alert_id","tag_id");
-- create alert_notification table v1
CREATE TABLE IF NOT EXISTS "alert_notification" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "name" VARCHAR(190) NOT NULL , "type" VARCHAR(255) NOT NULL , "settings" TEXT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- Add column is_default
alter table "alert_notification" ADD COLUMN "is_default" BOOL NOT NULL DEFAULT FALSE
-- Add column frequency
alter table "alert_notification" ADD COLUMN "frequency" BIGINT NULL
-- Add column send_reminder
alter table "alert_notification" ADD COLUMN "send_reminder" BOOL NULL DEFAULT FALSE
-- Add column disable_resolve_message
alter table "alert_notification" ADD COLUMN "disable_resolve_message" BOOL NOT NULL DEFAULT FALSE
-- add index alert_notification org_id & name
CREATE UNIQUE INDEX "UQE_alert_notification_org_id_name" ON "alert_notification" ("org_id","name");
-- Update alert table charset
ALTER TABLE "alert" ALTER "name" TYPE VARCHAR(255), ALTER "message" TYPE TEXT, ALTER "state" TYPE VARCHAR(190), ALTER "settings" TYPE TEXT, ALTER "severity" TYPE TEXT, ALTER "execution_error" TYPE TEXT, ALTER "eval_data" TYPE TEXT;
-- Update alert_notification table charset
ALTER TABLE "alert_notification" ALTER "name" TYPE VARCHAR(190), ALTER "type" TYPE VARCHAR(255), ALTER "settings" TYPE TEXT;
-- create notification_journal table v1
CREATE TABLE IF NOT EXISTS "alert_notification_journal" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "alert_id" BIGINT NOT NULL , "notifier_id" BIGINT NOT NULL , "sent_at" BIGINT NOT NULL , "success" BOOL NOT NULL );
-- add index notification_journal org_id & alert_id & notifier_id
CREATE INDEX "IDX_alert_notification_journal_org_id_alert_id_notifier_id" ON "alert_notification_journal" ("org_id","alert_id","notifier_id");
-- drop alert_notification_journal
DROP TABLE IF EXISTS "alert_notification_journal"
-- create alert_notification_state table v1
CREATE TABLE IF NOT EXISTS "alert_notification_state" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "alert_id" BIGINT NOT NULL , "notifier_id" BIGINT NOT NULL , "state" VARCHAR(50) NOT NULL , "version" BIGINT NOT NULL , "updated_at" BIGINT NOT NULL , "alert_rule_state_updated_version" BIGINT NOT NULL );
-- add index alert_notification_state org_id & alert_id & notifier_id
CREATE UNIQUE INDEX "UQE_alert_notification_state_org_id_alert_id_notifier_id" ON "alert_notification_state" ("org_id","alert_id","notifier_id");
-- Add for to alert table
alter table "alert" ADD COLUMN "for" BIGINT NULL
-- Add column uid in alert_notification
alter table "alert_notification" ADD COLUMN "uid" VARCHAR(40) NULL
-- Update uid column values in alert_notification
UPDATE alert_notification SET uid=lpad('' || id::text,9,'0') WHERE uid IS NULL;
-- Add unique index alert_notification_org_id_uid
CREATE UNIQUE INDEX "UQE_alert_notification_org_id_uid" ON "alert_notification" ("org_id","uid");
-- Remove unique index org_id_name
DROP INDEX "UQE_alert_notification_org_id_name" CASCADE
-- Drop old annotation table v4
DROP TABLE IF EXISTS "annotation"
-- create annotation table v5
CREATE TABLE IF NOT EXISTS "annotation" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "alert_id" BIGINT NULL , "user_id" BIGINT NULL , "dashboard_id" BIGINT NULL , "panel_id" BIGINT NULL , "category_id" BIGINT NULL , "type" VARCHAR(25) NOT NULL , "title" TEXT NOT NULL , "text" TEXT NOT NULL , "metric" VARCHAR(255) NULL , "prev_state" VARCHAR(25) NOT NULL , "new_state" VARCHAR(25) NOT NULL , "data" TEXT NOT NULL , "epoch" BIGINT NOT NULL );
-- add index annotation 0 v3
CREATE INDEX "IDX_annotation_org_id_alert_id" ON "annotation" ("org_id","alert_id");
-- add index annotation 1 v3
CREATE INDEX "IDX_annotation_org_id_type" ON "annotation" ("org_id","type");
-- add index annotation 2 v3
CREATE INDEX "IDX_annotation_org_id_category_id" ON "annotation" ("org_id","category_id");
-- add index annotation 3 v3
CREATE INDEX "IDX_annotation_org_id_dashboard_id_panel_id_epoch" ON "annotation" ("org_id","dashboard_id","panel_id","epoch");
-- add index annotation 4 v3
CREATE INDEX "IDX_annotation_org_id_epoch" ON "annotation" ("org_id","epoch");
-- Update annotation table charset
ALTER TABLE "annotation" ALTER "type" TYPE VARCHAR(25), ALTER "title" TYPE TEXT, ALTER "text" TYPE TEXT, ALTER "metric" TYPE VARCHAR(255), ALTER "prev_state" TYPE VARCHAR(25), ALTER "new_state" TYPE VARCHAR(25), ALTER "data" TYPE TEXT;
-- Add column region_id to annotation table
alter table "annotation" ADD COLUMN "region_id" BIGINT NULL DEFAULT 0
-- Drop category_id index
DROP INDEX "IDX_annotation_org_id_category_id" CASCADE
-- Add column tags to annotation table
alter table "annotation" ADD COLUMN "tags" VARCHAR(500) NULL
-- Create annotation_tag table v2
CREATE TABLE IF NOT EXISTS "annotation_tag" ( "annotation_id" BIGINT NOT NULL , "tag_id" BIGINT NOT NULL );
-- Add unique index annotation_tag.annotation_id_tag_id
CREATE UNIQUE INDEX "UQE_annotation_tag_annotation_id_tag_id" ON "annotation_tag" ("annotation_id","tag_id");
-- Update alert annotations and set TEXT to empty
UPDATE annotation SET TEXT = '' WHERE alert_id > 0
-- Add created time to annotation table
alter table "annotation" ADD COLUMN "created" BIGINT NULL DEFAULT 0
-- Add updated time to annotation table
alter table "annotation" ADD COLUMN "updated" BIGINT NULL DEFAULT 0
-- Add index for created in annotation table
CREATE INDEX "IDX_annotation_org_id_created" ON "annotation" ("org_id","created");
-- Add index for updated in annotation table
CREATE INDEX "IDX_annotation_org_id_updated" ON "annotation" ("org_id","updated");
-- Convert existing annotations from seconds to milliseconds
UPDATE annotation SET epoch = (epoch*1000) where epoch < 9999999999
-- Add epoch_end column
alter table "annotation" ADD COLUMN "epoch_end" BIGINT NOT NULL DEFAULT 0
-- Add index for epoch_end
CREATE INDEX "IDX_annotation_org_id_epoch_epoch_end" ON "annotation" ("org_id","epoch","epoch_end");
-- Make epoch_end the same as epoch
UPDATE annotation SET epoch_end = epoch
-- Remove index org_id_epoch from annotation table
DROP INDEX "IDX_annotation_org_id_epoch" CASCADE
-- Remove index org_id_dashboard_id_panel_id_epoch from annotation table
DROP INDEX "IDX_annotation_org_id_dashboard_id_panel_id_epoch" CASCADE
-- Add index for org_id_dashboard_id_epoch_end_epoch on annotation table
CREATE INDEX "IDX_annotation_org_id_dashboard_id_epoch_end_epoch" ON "annotation" ("org_id","dashboard_id","epoch_end","epoch");
-- Add index for org_id_epoch_end_epoch on annotation table
CREATE INDEX "IDX_annotation_org_id_epoch_end_epoch" ON "annotation" ("org_id","epoch_end","epoch");
-- Remove index org_id_epoch_epoch_end from annotation table
DROP INDEX "IDX_annotation_org_id_epoch_epoch_end" CASCADE
-- Add index for alert_id on annotation table
CREATE INDEX "IDX_annotation_alert_id" ON "annotation" ("alert_id");
-- create test_data table
CREATE TABLE IF NOT EXISTS "test_data" ( "id" SERIAL PRIMARY KEY  NOT NULL , "metric1" VARCHAR(20) NULL , "metric2" VARCHAR(150) NULL , "value_big_int" BIGINT NULL , "value_double" DOUBLE PRECISION NULL , "value_float" REAL NULL , "value_int" INTEGER NULL , "time_epoch" BIGINT NOT NULL , "time_date_time" TIMESTAMP NOT NULL , "time_time_stamp" TIMESTAMP NOT NULL );
-- create dashboard_version table v1
CREATE TABLE IF NOT EXISTS "dashboard_version" ( "id" SERIAL PRIMARY KEY  NOT NULL , "dashboard_id" BIGINT NOT NULL , "parent_version" INTEGER NOT NULL , "restored_from" INTEGER NOT NULL , "version" INTEGER NOT NULL , "created" TIMESTAMP NOT NULL , "created_by" BIGINT NOT NULL , "message" TEXT NOT NULL , "data" TEXT NOT NULL );
-- add index dashboard_version.dashboard_id
CREATE INDEX "IDX_dashboard_version_dashboard_id" ON "dashboard_version" ("dashboard_id");
-- add unique index dashboard_version.dashboard_id and dashboard_version.version
CREATE UNIQUE INDEX "UQE_dashboard_version_dashboard_id_version" ON "dashboard_version" ("dashboard_id","version");
-- Set dashboard version to 1 where 0
UPDATE dashboard SET version = 1 WHERE version = 0
-- add unique index cache_data.cache_key
CREATE UNIQUE INDEX "UQE_cache_data_cache_key" ON "cache_data" ("cache_key");
-- save existing dashboard data in dashboard_version table v1
INSERT INTO dashboard_version ( dashboard_id, version, parent_version, restored_from, created, created_by, message, data ) SELECT dashboard.id, dashboard.version, dashboard.version, dashboard.version, dashboard.updated, COALESCE(dashboard.updated_by, -1), '', dashboard.data FROM dashboard;
-- alter dashboard_version.data to mediumtext v1
SELECT 0;
-- create team table
CREATE TABLE IF NOT EXISTS "team" ( "id" SERIAL PRIMARY KEY  NOT NULL , "name" VARCHAR(190) NOT NULL , "org_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index team.org_id
CREATE INDEX "IDX_team_org_id" ON "team" ("org_id");
-- add unique index team_org_id_name
CREATE UNIQUE INDEX "UQE_team_org_id_name" ON "team" ("org_id","name");
-- create team member table
CREATE TABLE IF NOT EXISTS "team_member" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "team_id" BIGINT NOT NULL , "user_id" BIGINT NOT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index team_member.org_id
CREATE INDEX "IDX_team_member_org_id" ON "team_member" ("org_id");
-- add unique index team_member_org_id_team_id_user_id
CREATE UNIQUE INDEX "UQE_team_member_org_id_team_id_user_id" ON "team_member" ("org_id","team_id","user_id");
-- Add column email to team table
alter table "team" ADD COLUMN "email" VARCHAR(190) NULL
-- Add column external to team_member table
alter table "team_member" ADD COLUMN "external" BOOL NULL
-- Add column permission to team_member table
alter table "team_member" ADD COLUMN "permission" SMALLINT NULL
-- create dashboard acl table
CREATE TABLE IF NOT EXISTS "dashboard_acl" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "dashboard_id" BIGINT NOT NULL , "user_id" BIGINT NULL , "team_id" BIGINT NULL , "permission" SMALLINT NOT NULL DEFAULT 4 , "role" VARCHAR(20) NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- add index dashboard_acl_dashboard_id
CREATE INDEX "IDX_dashboard_acl_dashboard_id" ON "dashboard_acl" ("dashboard_id");
-- add unique index dashboard_acl_dashboard_id_user_id
CREATE UNIQUE INDEX "UQE_dashboard_acl_dashboard_id_user_id" ON "dashboard_acl" ("dashboard_id","user_id");
-- add unique index dashboard_acl_dashboard_id_team_id
CREATE UNIQUE INDEX "UQE_dashboard_acl_dashboard_id_team_id" ON "dashboard_acl" ("dashboard_id","team_id");
-- save default acl rules in dashboard_acl table
 INSERT INTO dashboard_acl ( org_id, dashboard_id, permission, role, created, updated ) VALUES (-1,-1, 1,'Viewer','2017-06-20','2017-06-20'), (-1,-1, 2,'Editor','2017-06-20','2017-06-20') 
-- create tag table
CREATE TABLE IF NOT EXISTS "tag" ( "id" SERIAL PRIMARY KEY  NOT NULL , "key" VARCHAR(100) NOT NULL , "value" VARCHAR(100) NOT NULL );
-- add index tag.key_value
CREATE UNIQUE INDEX "UQE_tag_key_value" ON "tag" ("key","value");
-- create login attempt table
CREATE TABLE IF NOT EXISTS "login_attempt" ( "id" SERIAL PRIMARY KEY  NOT NULL , "username" VARCHAR(190) NOT NULL , "ip_address" VARCHAR(30) NOT NULL , "created" TIMESTAMP NOT NULL );
-- add index login_attempt.username
CREATE INDEX "IDX_login_attempt_username" ON "login_attempt" ("username");
-- drop index IDX_login_attempt_username - v1
DROP INDEX "IDX_login_attempt_username" CASCADE
-- Rename table login_attempt to login_attempt_tmp_qwerty - v1
ALTER TABLE "login_attempt" RENAME TO "login_attempt_tmp_qwerty"
-- create login_attempt v2
CREATE TABLE IF NOT EXISTS "login_attempt" ( "id" SERIAL PRIMARY KEY  NOT NULL , "username" VARCHAR(190) NOT NULL , "ip_address" VARCHAR(30) NOT NULL , "created" INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_login_attempt_username - v2
CREATE INDEX "IDX_login_attempt_username" ON "login_attempt" ("username");
-- copy login_attempt v1 to v2
INSERT INTO "login_attempt" ("id" , "username" , "ip_address") SELECT "id" , "username" , "ip_address" FROM "login_attempt_tmp_qwerty"
-- drop login_attempt_tmp_qwerty
DROP TABLE IF EXISTS "login_attempt_tmp_qwerty"
-- create user auth table
CREATE TABLE IF NOT EXISTS "user_auth" ( "id" SERIAL PRIMARY KEY  NOT NULL , "user_id" BIGINT NOT NULL , "auth_module" VARCHAR(190) NOT NULL , "auth_id" VARCHAR(100) NOT NULL , "created" TIMESTAMP NOT NULL );
-- create index IDX_user_auth_auth_module_auth_id - v1
CREATE INDEX "IDX_user_auth_auth_module_auth_id" ON "user_auth" ("auth_module","auth_id");
-- alter user_auth.auth_id to length 190
ALTER TABLE user_auth ALTER COLUMN auth_id TYPE VARCHAR(190);
-- Add OAuth access token to user_auth
alter table "user_auth" ADD COLUMN "o_auth_access_token" TEXT NULL
-- Add OAuth refresh token to user_auth
alter table "user_auth" ADD COLUMN "o_auth_refresh_token" TEXT NULL
-- Add OAuth token type to user_auth
alter table "user_auth" ADD COLUMN "o_auth_token_type" TEXT NULL
-- Add OAuth expiry to user_auth
alter table "user_auth" ADD COLUMN "o_auth_expiry" TIMESTAMP NULL
-- Add index to user_id column in user_auth
CREATE INDEX "IDX_user_auth_user_id" ON "user_auth" ("user_id");
-- create server_lock table
CREATE TABLE IF NOT EXISTS "server_lock" ( "id" SERIAL PRIMARY KEY  NOT NULL , "operation_uid" VARCHAR(100) NOT NULL , "version" BIGINT NOT NULL , "last_execution" BIGINT NOT NULL );
-- add index server_lock.operation_uid
CREATE UNIQUE INDEX "UQE_server_lock_operation_uid" ON "server_lock" ("operation_uid");
-- create user auth token table
CREATE TABLE IF NOT EXISTS "user_auth_token" ( "id" SERIAL PRIMARY KEY  NOT NULL , "user_id" BIGINT NOT NULL , "auth_token" VARCHAR(100) NOT NULL , "prev_auth_token" VARCHAR(100) NOT NULL , "user_agent" VARCHAR(255) NOT NULL , "client_ip" VARCHAR(255) NOT NULL , "auth_token_seen" BOOL NOT NULL , "seen_at" INTEGER NULL , "rotated_at" INTEGER NOT NULL , "created_at" INTEGER NOT NULL , "updated_at" INTEGER NOT NULL );
-- add unique index user_auth_token.auth_token
CREATE UNIQUE INDEX "UQE_user_auth_token_auth_token" ON "user_auth_token" ("auth_token");
-- add unique index user_auth_token.prev_auth_token
CREATE UNIQUE INDEX "UQE_user_auth_token_prev_auth_token" ON "user_auth_token" ("prev_auth_token");
-- create cache_data table
CREATE TABLE IF NOT EXISTS "cache_data" ( "cache_key" VARCHAR(168) PRIMARY KEY NOT NULL , "data" BYTEA NOT NULL , "expires" INTEGER NOT NULL , "created_at" INTEGER NOT NULL );
