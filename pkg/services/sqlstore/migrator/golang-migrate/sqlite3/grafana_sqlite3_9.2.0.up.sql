-- Add is_revoked column to api_key table
ALTER TABLE `api_key` ADD COLUMN `is_revoked` INTEGER NULL DEFAULT 0
-- add index correlations.uid
CREATE INDEX `IDX_correlation_uid` ON `correlation` (`uid`);
-- add index correlations.source_uid
CREATE INDEX `IDX_correlation_source_uid` ON `correlation` (`source_uid`);
