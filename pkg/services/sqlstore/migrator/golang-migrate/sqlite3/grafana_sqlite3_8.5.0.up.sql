-- Update is_service_account column to nullable
ALTER TABLE user ADD COLUMN tmp_service_account BOOLEAN DEFAULT 0; UPDATE user SET tmp_service_account = is_service_account; ALTER TABLE user DROP COLUMN is_service_account; ALTER TABLE user RENAME COLUMN tmp_service_account TO is_service_account;
-- set service account foreign key to nil if 0
UPDATE api_key SET service_account_id = NULL WHERE service_account_id = 0;
-- Add column preferences.json_data
ALTER TABLE `preferences` ADD COLUMN `json_data` TEXT NULL;
-- add configuration_hash column to alert_configuration
ALTER TABLE `alert_configuration` ADD COLUMN `configuration_hash` TEXT NOT NULL DEFAULT 'not-yet-calculated';
ALTER TABLE `ngalert_configuration` ADD COLUMN `send_alerts_to` INTEGER NOT NULL DEFAULT 0;
-- create provenance_type table
CREATE TABLE IF NOT EXISTS `provenance_type` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `org_id` INTEGER NOT NULL , `record_key` TEXT NOT NULL , `record_type` TEXT NOT NULL , `provenance` TEXT NOT NULL );
-- add index to uniquify (record_key, record_type, org_id) columns
CREATE UNIQUE INDEX `UQE_provenance_type_record_type_record_key_org_id` ON `provenance_type` (`record_type`,`record_key`,`org_id`);
-- add column hidden to role table
ALTER TABLE `role` ADD COLUMN `hidden` INTEGER NOT NULL DEFAULT 0;
-- create query_history_star table v1
CREATE TABLE IF NOT EXISTS `query_history_star` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , `query_uid` TEXT NOT NULL , `user_id` INTEGER NOT NULL );
-- add index query_history.user_id-query_uid
CREATE UNIQUE INDEX `UQE_query_history_star_user_id_query_uid` ON `query_history_star` (`user_id`,`query_uid`);
