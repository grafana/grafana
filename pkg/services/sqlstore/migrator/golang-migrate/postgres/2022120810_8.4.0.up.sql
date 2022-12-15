-- add unique index builtin_role_role_name
CREATE UNIQUE INDEX "UQE_seed_assignment_builtin_role_role_name" ON "seed_assignment" ("builtin_role","role_name");
-- Add OAuth ID token to user_auth
alter table "user_auth" ADD COLUMN "o_auth_id_token" TEXT NULL
-- add column send_alerts_to in ngalert_configuration
alter table "ngalert_configuration" ADD COLUMN "send_alerts_to" SMALLINT NOT NULL
-- create query_history table v1
CREATE TABLE IF NOT EXISTS "query_history" ( "id" SERIAL PRIMARY KEY  NOT NULL , "uid" VARCHAR(40) NOT NULL , "org_id" BIGINT NOT NULL , "datasource_uid" VARCHAR(40) NOT NULL , "created_by" INTEGER NOT NULL , "created_at" INTEGER NOT NULL , "comment" TEXT NOT NULL , "queries" TEXT NOT NULL );
-- add index query_history.org_id-created_by-datasource_uid
CREATE INDEX "IDX_query_history_org_id_created_by_datasource_uid" ON "query_history" ("org_id","created_by","datasource_uid");
