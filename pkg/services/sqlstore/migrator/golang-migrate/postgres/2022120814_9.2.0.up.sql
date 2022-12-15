-- Add is_revoked column to api_key table
alter table "api_key" ADD COLUMN "is_revoked" BOOL NULL DEFAULT FALSE
-- Increase tags column to length 4096
ALTER TABLE annotation ALTER COLUMN tags TYPE VARCHAR(4096);
-- alter table short_url alter column created_by type to bigint
ALTER TABLE short_url ALTER COLUMN created_by TYPE BIGINT;
-- support longer URLs in alert_image table
ALTER TABLE alert_image ALTER COLUMN url TYPE VARCHAR(2048);
-- alter table query_history alter column created_by type to bigint
ALTER TABLE query_history ALTER COLUMN created_by TYPE BIGINT;
-- alter table query_history_star_mig column user_id type to bigint
ALTER TABLE query_history_star ALTER COLUMN user_id TYPE BIGINT;
-- add index correlations.uid
CREATE INDEX "IDX_correlation_uid" ON "correlation" ("uid");
-- add index correlations.source_uid
CREATE INDEX "IDX_correlation_source_uid" ON "correlation" ("source_uid");
