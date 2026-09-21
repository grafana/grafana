CREATE TABLE IF NOT EXISTS error_tracking_schema_migration (
    version INTEGER PRIMARY KEY,
    hash TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS error_tracking_event (
    id BIGSERIAL PRIMARY KEY,
    created_at BIGINT NOT NULL,
    occurred_at BIGINT NOT NULL,
    tenant_namespace VARCHAR(255) NOT NULL,
    project VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    source_ip VARCHAR(64) NOT NULL
);
CREATE INDEX IF NOT EXISTS error_tracking_event_tenant_created_at
    ON error_tracking_event (tenant_namespace, created_at);
CREATE INDEX IF NOT EXISTS error_tracking_event_tenant_occurred_at
    ON error_tracking_event (tenant_namespace, occurred_at);
