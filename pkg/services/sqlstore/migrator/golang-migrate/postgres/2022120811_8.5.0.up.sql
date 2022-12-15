-- add index query_history.org_id-created_by-datasource_uid
CREATE INDEX "IDX_query_history_org_id_created_by_datasource_uid" ON "query_history" ("org_id","created_by","datasource_uid");
-- Update is_service_account column to nullable
ALTER TABLE `user` ALTER COLUMN is_service_account DROP NOT NULL;
-- set service account foreign key to nil if 0
UPDATE api_key SET service_account_id = NULL WHERE service_account_id = 0;
-- Add column preferences.json_data
alter table "preferences" ADD COLUMN "json_data" TEXT NULL
-- alter preferences.json_data to mediumtext v1
SELECT 0;
-- add configuration_hash column to alert_configuration
alter table "alert_configuration" ADD COLUMN "configuration_hash" VARCHAR(32) NOT NULL DEFAULT 'not-yet-calculated'
-- create provenance_type table
CREATE TABLE IF NOT EXISTS "provenance_type" ( "id" SERIAL PRIMARY KEY  NOT NULL , "org_id" BIGINT NOT NULL , "record_key" VARCHAR(190) NOT NULL , "record_type" VARCHAR(190) NOT NULL , "provenance" VARCHAR(190) NOT NULL );
-- add index to uniquify (record_key, record_type, org_id) columns
CREATE UNIQUE INDEX "UQE_provenance_type_record_type_record_key_org_id" ON "provenance_type" ("record_type","record_key","org_id");
-- increase max description length to 2048
ALTER TABLE "library_element" ALTER "description" TYPE VARCHAR(2048);
-- add column hidden to role table
alter table "role" ADD COLUMN "hidden" BOOL NOT NULL DEFAULT FALSE
-- create query_history_star table v1
CREATE TABLE IF NOT EXISTS "query_history_star" ( "id" SERIAL PRIMARY KEY  NOT NULL , "query_uid" VARCHAR(40) NOT NULL , "user_id" INTEGER NOT NULL );
-- add index query_history.user_id-query_uid
CREATE UNIQUE INDEX "UQE_query_history_star_user_id_query_uid" ON "query_history_star" ("user_id","query_uid");
