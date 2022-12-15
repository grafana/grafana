-- Add is_revoked column to api_key table
alter table `api_key` ADD COLUMN `is_revoked` TINYINT(1) NULL DEFAULT 0
-- Increase tags column to length 4096
ALTER TABLE annotation MODIFY tags VARCHAR(4096);
-- alter table short_url alter column created_by type to bigint
ALTER TABLE short_url MODIFY created_by BIGINT;
-- support longer URLs in alert_image table
ALTER TABLE alert_image MODIFY url VARCHAR(2048) NOT NULL;
-- alter table query_history alter column created_by type to bigint
ALTER TABLE query_history MODIFY created_by BIGINT;
-- alter table query_history_star_mig column user_id type to bigint
ALTER TABLE query_history_star MODIFY user_id BIGINT;
-- add index correlations.uid
CREATE INDEX `IDX_correlation_uid` ON `correlation` (`uid`);
-- add index correlations.source_uid
CREATE INDEX `IDX_correlation_source_uid` ON `correlation` (`source_uid`);
