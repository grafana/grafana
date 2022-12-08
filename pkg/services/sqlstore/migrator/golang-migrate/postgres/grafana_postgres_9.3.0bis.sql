-- create folder table
CREATE TABLE IF NOT EXISTS "folder" ( "id" SERIAL PRIMARY KEY  NOT NULL , "uid" VARCHAR(40) NOT NULL , "org_id" BIGINT NOT NULL , "title" VARCHAR(255) NOT NULL , "description" VARCHAR(255) NULL , "parent_uid" VARCHAR(40) NULL , "created" TIMESTAMP NOT NULL , "updated" TIMESTAMP NOT NULL );
-- Add index for parent_uid
CREATE INDEX "IDX_folder_parent_uid_org_id" ON "folder" ("parent_uid","org_id");
-- Add unique index for folder.uid and folder.org_id
CREATE UNIQUE INDEX "UQE_folder_uid_org_id" ON "folder" ("uid","org_id");
-- Add unique index for folder.title and folder.parent_uid
CREATE UNIQUE INDEX "UQE_folder_title_parent_uid" ON "folder" ("title","parent_uid");
-- copy existing folders from dashboard table
INSERT INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = true ON CONFLICT DO NOTHING