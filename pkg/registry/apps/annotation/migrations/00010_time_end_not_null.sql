-- +goose Up
ALTER TABLE annotations ALTER COLUMN time_end SET NOT NULL;
DROP INDEX IF EXISTS idx_time;
DROP INDEX IF EXISTS idx_ns_time;
DROP INDEX IF EXISTS idx_time_end;
DROP INDEX IF EXISTS idx_dashboard;
CREATE INDEX idx_ns_time_end ON annotations (namespace, time_end DESC, time DESC, name);
CREATE INDEX idx_dashboard_time_end ON annotations (namespace, dashboard_uid, time_end DESC, time DESC, name);

-- +goose Down
DROP INDEX IF EXISTS idx_dashboard_time_end;
DROP INDEX IF EXISTS idx_ns_time_end;
CREATE INDEX idx_time ON annotations USING BRIN (time);
CREATE INDEX idx_ns_time ON annotations (namespace, time);
CREATE INDEX idx_dashboard ON annotations (namespace, dashboard_uid, panel_id, time);
CREATE INDEX idx_time_end ON annotations (namespace, time_end) WHERE time_end IS NOT NULL;
ALTER TABLE annotations ALTER COLUMN time_end DROP NOT NULL;
