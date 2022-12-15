-- Update is_service_account column to nullable
ALTER TABLE user MODIFY is_service_account BOOLEAN DEFAULT 0;
-- set service account foreign key to nil if 0
UPDATE api_key SET service_account_id = NULL WHERE service_account_id = 0;
-- Add column preferences.json_data
alter table `preferences` ADD COLUMN `json_data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- alter preferences.json_data to mediumtext v1
ALTER TABLE preferences MODIFY json_data MEDIUMTEXT;
-- add configuration_hash column to alert_configuration
alter table `alert_configuration` ADD COLUMN `configuration_hash` VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'not-yet-calculated'
-- create provenance_type table
CREATE TABLE IF NOT EXISTS `provenance_type` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `org_id` BIGINT(20) NOT NULL , `record_key` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `record_type` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `provenance` VARCHAR(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index to uniquify (record_key, record_type, org_id) columns
CREATE UNIQUE INDEX `UQE_provenance_type_record_type_record_key_org_id` ON `provenance_type` (`record_type`,`record_key`,`org_id`);
-- increase max description length to 2048
ALTER TABLE `library_element` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci, MODIFY `description` VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL ;
-- add column hidden to role table
alter table `role` ADD COLUMN `hidden` TINYINT(1) NOT NULL DEFAULT 0
-- create query_history_star table v1
CREATE TABLE IF NOT EXISTS `query_history_star` ( `id` BIGINT(20) PRIMARY KEY AUTO_INCREMENT NOT NULL , `query_uid` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL , `user_id` INT NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- add index query_history.user_id-query_uid
CREATE UNIQUE INDEX `UQE_query_history_star_user_id_query_uid` ON `query_history_star` (`user_id`,`query_uid`);
