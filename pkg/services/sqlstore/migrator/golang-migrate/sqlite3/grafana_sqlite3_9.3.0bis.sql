-- create folder table
CREATE TABLE IF NOT EXISTS `folder` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `title` TEXT NOT NULL , `description` TEXT NULL , `parent_uid` TEXT NOT NULL DEFAULT 'general' , `created` DATETIME NOT NULL , `updated` DATETIME NOT NULL );
-- Add index for parent_uid
CREATE INDEX `IDX_folder_parent_uid_org_id` ON `folder` (`parent_uid`,`org_id`);
-- Add unique index for folder.uid and folder.org_id
CREATE UNIQUE INDEX `UQE_folder_uid_org_id` ON `folder` (`uid`,`org_id`);
-- Add unique index for folder.title and folder.parent_uid
CREATE UNIQUE INDEX `UQE_folder_title_parent_uid` ON `folder` (`title`,`parent_uid`);
-- copy existing folders from dashboard table
INSERT OR REPLACE INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1;