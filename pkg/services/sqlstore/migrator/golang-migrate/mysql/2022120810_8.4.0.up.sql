-- Add OAuth ID token to user_auth
alter table `user_auth` ADD COLUMN `o_auth_id_token` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- add column send_alerts_to in ngalert_configuration
alter table `ngalert_configuration` ADD COLUMN `send_alerts_to` SMALLINT NOT NULL
-- create query_history table v1
CREATE TABLE IF NOT EXISTS `query_history` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `org_id` BIGINT(20) NOT NULL , `datasource_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `created_by` INT NOT NULL , `created_at` INT NOT NULL , `comment` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `queries` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index query_history.org_id-created_by-datasource_uid
CREATE INDEX `IDX_query_history_org_id_created_by_datasource_uid` ON `query_history` (`org_id`,`created_by`,`datasource_uid`);
