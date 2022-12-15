-- alter alert.settings to mediumtext
SELECT 0;
-- drop index IDX_temp_user_email - v1
DROP INDEX "IDX_temp_user_email" CASCADE
-- drop index IDX_temp_user_org_id - v1
DROP INDEX "IDX_temp_user_org_id" CASCADE
-- drop index IDX_temp_user_code - v1
DROP INDEX "IDX_temp_user_code" CASCADE
-- drop index IDX_temp_user_status - v1
DROP INDEX "IDX_temp_user_status" CASCADE
-- Rename table temp_user to temp_user_tmp_qwerty - v1
ALTER TABLE "temp_user" RENAME TO "temp_user_tmp_qwerty"
-- create temp_user v2
CREATE TABLE IF NOT EXISTS "temp_user" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "version" INTEGER NOT NULL , "email" VARCHAR(190) NOT NULL , "name" VARCHAR(255) NULL , "role" VARCHAR(20) NULL , "code" VARCHAR(190) NOT NULL , "status" VARCHAR(20) NOT NULL , "invited_by_user_id" BIGINT NULL , "email_sent" BOOL NOT NULL , "email_sent_on" TIMESTAMP NULL , "remote_addr" VARCHAR(255) NULL , "created" INTEGER NOT NULL DEFAULT 0 , "updated" INTEGER NOT NULL DEFAULT 0 );
-- create index IDX_temp_user_email - v2
CREATE INDEX "IDX_temp_user_email" ON "temp_user" ("email");
-- create index IDX_temp_user_org_id - v2
CREATE INDEX "IDX_temp_user_org_id" ON "temp_user" ("org_id");
-- create index IDX_temp_user_code - v2
CREATE INDEX "IDX_temp_user_code" ON "temp_user" ("code");
-- create index IDX_temp_user_status - v2
CREATE INDEX "IDX_temp_user_status" ON "temp_user" ("status");
-- copy temp_user v1 to v2
INSERT INTO "temp_user" ("name" , "code" , "status" , "invited_by_user_id" , "email_sent" , "remote_addr" , "id" , "version" , "email" , "role" , "email_sent_on" , "org_id") SELECT "name" , "code" , "status" , "invited_by_user_id" , "email_sent" , "remote_addr" , "id" , "version" , "email" , "role" , "email_sent_on" , "org_id" FROM "temp_user_tmp_qwerty"
-- drop temp_user_tmp_qwerty
DROP TABLE IF EXISTS "temp_user_tmp_qwerty"
-- Add encrypted dashboard json column
alter table "dashboard_snapshot" ADD COLUMN "dashboard_encrypted" BYTEA NULL
-- Add non-unique index alert_notification_state_alert_id
CREATE INDEX "IDX_alert_notification_state_alert_id" ON "alert_notification_state" ("alert_id");
-- Add non-unique index alert_rule_tag_alert_id
CREATE INDEX "IDX_alert_rule_tag_alert_id" ON "alert_rule_tag" ("alert_id");
-- add index user_auth_token.user_id
CREATE INDEX "IDX_user_auth_token_user_id" ON "user_auth_token" ("user_id");
-- create short_url table v1
CREATE TABLE IF NOT EXISTS "short_url" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "uid" VARCHAR(40) NOT NULL , "path" TEXT NOT NULL , "created_by" INTEGER NOT NULL , "created_at" INTEGER NOT NULL , "last_seen_at" INTEGER NULL );
-- add index short_url.org_id-uid
CREATE UNIQUE INDEX "UQE_short_url_org_id_uid" ON "short_url" ("org_id","uid");
