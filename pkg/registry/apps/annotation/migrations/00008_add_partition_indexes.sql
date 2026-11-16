-- +goose Up
CREATE INDEX idx_time ON annotations USING BRIN (time);
CREATE INDEX idx_ns_time ON annotations (namespace, time);
CREATE INDEX idx_dashboard ON annotations (namespace, dashboard_uid, panel_id, time);
CREATE INDEX idx_time_end ON annotations (namespace, time_end) WHERE time_end IS NOT NULL;
CREATE INDEX idx_tags ON annotations USING GIN (namespace, tags);
CREATE INDEX idx_scopes ON annotations USING GIN (namespace, scopes);

-- +goose Down
DROP INDEX IF EXISTS idx_time;
DROP INDEX IF EXISTS idx_ns_time;
DROP INDEX IF EXISTS idx_dashboard;
DROP INDEX IF EXISTS idx_time_end;
DROP INDEX IF EXISTS idx_tags;
DROP INDEX IF EXISTS idx_scopes;
