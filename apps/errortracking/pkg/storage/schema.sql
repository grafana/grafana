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

-- Error tracking model: project, environment, error, event, error status.
-- '' means "the SDK sent none" for environment names and releases; it is a real value, never NULL.
-- Every statement below is idempotent because migrate re-applies this file on every run.
DO $$
BEGIN
    CREATE TYPE error_status AS ENUM ('unresolved', 'resolved', 'ignored');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS projects (
    id               BIGSERIAL PRIMARY KEY,
    tenant_namespace TEXT NOT NULL,
    name             TEXT NOT NULL,
    description      TEXT NOT NULL DEFAULT '',
    -- 16 random bytes as hex, so the key is safe inside a DSN without encoding
    ingest_key       TEXT NOT NULL CHECK (ingest_key ~ '^[0-9a-f]{32}$'),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_namespace, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_ingest_key ON projects (ingest_key);

CREATE TABLE IF NOT EXISTS environments (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, name)
);

-- One row per (project, fingerprint). The same bug in dev and prod is one error;
-- the environment lives on the event.
CREATE TABLE IF NOT EXISTS errors (
    id                   BIGSERIAL PRIMARY KEY,
    project_id           BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    fingerprint          TEXT NOT NULL,
    status               error_status NOT NULL DEFAULT 'unresolved',
    exception_type       TEXT NOT NULL DEFAULT '',
    message              TEXT NOT NULL DEFAULT '',
    culprit              TEXT NOT NULL DEFAULT '',
    event_count          BIGINT NOT NULL DEFAULT 0,
    first_seen           TIMESTAMPTZ NOT NULL,
    last_seen            TIMESTAMPTZ NOT NULL,
    regressed            BOOLEAN NOT NULL DEFAULT FALSE,
    -- release a person resolved or ignored the error at; '' means no gate, any new event reopens it
    snapshot_release     TEXT NOT NULL DEFAULT '',
    ignored_until_at     TIMESTAMPTZ,
    ignored_until_events BIGINT,
    UNIQUE (project_id, fingerprint),
    CONSTRAINT errors_regressed_only_unresolved
        CHECK (NOT regressed OR status = 'unresolved'),
    CONSTRAINT errors_ignored_has_condition
        CHECK (status <> 'ignored' OR ignored_until_at IS NOT NULL OR ignored_until_events IS NOT NULL),
    CONSTRAINT errors_ignored_until_only_when_ignored
        CHECK (status = 'ignored' OR (ignored_until_at IS NULL AND ignored_until_events IS NULL))
);
CREATE INDEX IF NOT EXISTS errors_project_status_last_seen ON errors (project_id, status, last_seen DESC, id DESC);
CREATE INDEX IF NOT EXISTS errors_project_last_seen        ON errors (project_id, last_seen DESC, id DESC);
CREATE INDEX IF NOT EXISTS errors_unresolved_last_seen     ON errors (last_seen) WHERE status = 'unresolved';
CREATE INDEX IF NOT EXISTS errors_ignored_until_at         ON errors (ignored_until_at) WHERE status = 'ignored';

CREATE TABLE IF NOT EXISTS events (
    id             BIGSERIAL PRIMARY KEY,
    error_id       BIGINT NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
    environment_id BIGINT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    -- the SDK's event id; a resent event is a no-op, not a second row
    event_id       TEXT NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL,
    release        TEXT NOT NULL DEFAULT '',
    payload        JSONB NOT NULL,
    UNIQUE (error_id, event_id)
);
CREATE INDEX IF NOT EXISTS events_error_occurred_at ON events (error_id, occurred_at DESC, id DESC);

-- Lifecycle log: creation (from_status NULL) and every status transition write one row.
CREATE TABLE IF NOT EXISTS error_status_changes (
    id          BIGSERIAL PRIMARY KEY,
    error_id    BIGINT NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
    from_status error_status,
    to_status   error_status NOT NULL,
    actor       TEXT NOT NULL CHECK (actor <> ''),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_status IS DISTINCT FROM to_status)
);
CREATE INDEX IF NOT EXISTS error_status_changes_error ON error_status_changes (error_id, created_at DESC);
