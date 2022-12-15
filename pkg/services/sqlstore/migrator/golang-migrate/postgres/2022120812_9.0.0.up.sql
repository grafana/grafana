-- add index query_history.user_id-query_uid
CREATE UNIQUE INDEX "UQE_query_history_star_user_id_query_uid" ON "query_history_star" ("user_id","query_uid");
-- Add isPublic for dashboard
alter table "dashboard" ADD COLUMN "is_public" BOOL NOT NULL DEFAULT FALSE
-- add current_reason column related to current_state
alter table "alert_instance" ADD COLUMN "current_reason" VARCHAR(190) NULL
-- create alert_image table
CREATE TABLE IF NOT EXISTS "alert_image" ( "id" SERIAL PRIMARY KEY  NOT NULL , "token" VARCHAR(190) NOT NULL , "path" VARCHAR(190) NOT NULL , "url" VARCHAR(190) NOT NULL , "created_at" TIMESTAMP NOT NULL , "expires_at" TIMESTAMP NOT NULL );
-- add unique index on token to alert_image table
CREATE UNIQUE INDEX "UQE_alert_image_token" ON "alert_image" ("token");
-- create secrets table
CREATE TABLE IF NOT EXISTS "secrets" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "namespace" VARCHAR(255) NOT NULL , "type" VARCHAR(255) NOT NULL , "value" TEXT NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- rename data_keys name column to id
ALTER TABLE "data_keys" RENAME COLUMN "name" TO "id"
-- add name column into data_keys
alter table "data_keys" ADD COLUMN "name" VARCHAR(100) NOT NULL DEFAULT ''
-- copy data_keys id column values into name
UPDATE data_keys SET name = id
-- rename data_keys name column to label
ALTER TABLE "data_keys" RENAME COLUMN "name" TO "label"
-- rename data_keys id column back to name
ALTER TABLE "data_keys" RENAME COLUMN "id" TO "name"
-- add column org_id in query_history_star
alter table "query_history_star" ADD COLUMN "org_id" BIGINT NOT NULL DEFAULT 1
-- create entity_events table
CREATE TABLE IF NOT EXISTS "entity_event" ( "id" SERIAL PRIMARY KEY  NOT NULL , "entity_id" VARCHAR(1024) NOT NULL , "event_type" VARCHAR(8) NOT NULL , "created" BIGINT NOT NULL );
-- create dashboard public config v1
CREATE TABLE IF NOT EXISTS "dashboard_public_config" ( "uid" BIGINT PRIMARY KEY NOT NULL , "dashboard_uid" VARCHAR(40) NOT NULL , "org_id" BIGINT NOT NULL , "refresh_rate" INTEGER NOT NULL DEFAULT 30 , "template_variables" TEXT NULL , "time_variables" TEXT NOT NULL );
-- create index UQE_dashboard_public_config_uid - v1
CREATE UNIQUE INDEX "UQE_dashboard_public_config_uid" ON "dashboard_public_config" ("uid");
-- create index IDX_dashboard_public_config_org_id_dashboard_uid - v1
CREATE INDEX "IDX_dashboard_public_config_org_id_dashboard_uid" ON "dashboard_public_config" ("org_id","dashboard_uid");
-- create file table
CREATE TABLE IF NOT EXISTS "file" ( "path" VARCHAR(1024) NOT NULL , "path_hash" VARCHAR(64) NOT NULL , "parent_folder_path_hash" VARCHAR(64) NOT NULL , "contents" BYTEA NOT NULL , "etag" VARCHAR(32) NOT NULL , "cache_control" VARCHAR(128) NOT NULL , "content_disposition" VARCHAR(128) NOT NULL , "updated" TIMESTAMP NOT NULL , "created" TIMESTAMP NOT NULL , "size" BIGINT NOT NULL , "mime_type" VARCHAR(255) NOT NULL );
-- file table idx: path natural pk
CREATE UNIQUE INDEX "UQE_file_path_hash" ON "file" ("path_hash");
-- file table idx: parent_folder_path_hash fast folder retrieval
CREATE INDEX "IDX_file_parent_folder_path_hash" ON "file" ("parent_folder_path_hash");
-- create file_meta table
CREATE TABLE IF NOT EXISTS "file_meta" ( "path_hash" VARCHAR(64) NOT NULL , "key" VARCHAR(191) NOT NULL , "value" VARCHAR(1024) NOT NULL );
-- file table idx: path key
CREATE UNIQUE INDEX "UQE_file_meta_path_hash_key" ON "file_meta" ("path_hash","key");
-- set path collation in file table
ALTER TABLE file ALTER COLUMN path TYPE VARCHAR(1024) COLLATE "C";
