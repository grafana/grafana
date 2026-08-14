-- +goose Up
-- Create partitioned annotations table
CREATE TABLE IF NOT EXISTS annotations (
  namespace VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  time BIGINT NOT NULL,
  time_end BIGINT,
  dashboard_uid VARCHAR(40),
  panel_id BIGINT,
  text TEXT NOT NULL,
  tags TEXT[],
  scopes TEXT[],
  created_by VARCHAR(255),
  created_at BIGINT NOT NULL,
  PRIMARY KEY (namespace, name, time),
  CHECK (time_end IS NULL OR time_end >= time)
) PARTITION BY RANGE (time);

-- +goose Down
-- Drop the partitioned table (will cascade to all partitions)
DROP TABLE IF EXISTS annotations CASCADE;
