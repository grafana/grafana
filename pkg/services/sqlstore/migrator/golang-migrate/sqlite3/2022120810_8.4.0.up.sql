-- Add OAuth ID token to user_auth
ALTER TABLE `user_auth` ADD COLUMN `o_auth_id_token` TEXT NULL;
-- add column send_alerts_to in ngalert_configuration
ALTER TABLE `ngalert_configuration` ADD COLUMN `send_alerts_to` INTEGER NOT NULL DEFAULT 0;
-- create query_history table v1
CREATE TABLE IF NOT EXISTS `query_history` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `uid` TEXT NOT NULL , `org_id` INTEGER NOT NULL , `datasource_uid` TEXT NOT NULL , `created_by` INTEGER NOT NULL , `created_at` INTEGER NOT NULL , `comment` TEXT NOT NULL , `queries` TEXT NOT NULL );
-- add index query_history.org_id-created_by-datasource_uid
CREATE INDEX `IDX_query_history_org_id_created_by_datasource_uid` ON `query_history` (`org_id`,`created_by`,`datasource_uid`);
