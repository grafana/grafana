-- Add column secure_settings in alert_notification
alter table `alert_notification` ADD COLUMN `secure_settings` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
-- alter alert.settings to mediumtext
ALTER TABLE alert MODIFY settings MEDIUMTEXT;
