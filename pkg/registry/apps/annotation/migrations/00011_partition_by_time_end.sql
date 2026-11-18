-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
    part record;
    week_start timestamp;
BEGIN
    -- Move old tables to a temporary schema
    CREATE SCHEMA annotations_repartition;
    FOR part IN SELECT inhrelid::regclass AS rel FROM pg_inherits WHERE inhparent = 'annotations'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %s SET SCHEMA annotations_repartition', part.rel);
    END LOOP;
    ALTER TABLE annotations SET SCHEMA annotations_repartition;

    -- Recreate table partitioned by time_end
    CREATE TABLE annotations (
        LIKE annotations_repartition.annotations INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
        PRIMARY KEY (namespace, name, time_end)
    ) PARTITION BY RANGE (time_end);

    -- Re-create existing weekly partitions in the new table
    FOR week_start IN
        SELECT DISTINCT date_trunc('week', to_timestamp(time_end / 1000.0) AT TIME ZONE 'UTC')
        FROM annotations_repartition.annotations
    LOOP
        EXECUTE format('CREATE TABLE %I PARTITION OF annotations FOR VALUES FROM (%s) TO (%s)',
            'annotations_' || to_char(week_start, 'IYYY"w"IW'),
            (extract(epoch FROM week_start) * 1000)::bigint,
            (extract(epoch FROM week_start + interval '7 days') * 1000)::bigint);
    END LOOP;

    -- Copy data from the old tables to new tables and drop the old tables
    INSERT INTO annotations SELECT * FROM annotations_repartition.annotations;
    DROP SCHEMA annotations_repartition CASCADE;
END $$;
-- +goose StatementEnd

-- Recreate indexes
CREATE INDEX idx_ns_time_end ON annotations (namespace, time_end DESC, time DESC, name);
CREATE INDEX idx_dashboard_time_end ON annotations (namespace, dashboard_uid, time_end DESC, time DESC, name);
CREATE INDEX idx_tags ON annotations USING GIN (namespace, tags);
CREATE INDEX idx_scopes ON annotations USING GIN (namespace, scopes);
CREATE INDEX idx_legacy_id ON annotations (namespace, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX idx_legacy_migrated ON annotations (namespace) WHERE legacy_migrated;

-- +goose Down
-- +goose StatementBegin
DO $$
DECLARE
    part record;
    week_start timestamp;
BEGIN
    -- Move old tables to a temporary schema
    CREATE SCHEMA annotations_repartition;
    FOR part IN SELECT inhrelid::regclass AS rel FROM pg_inherits WHERE inhparent = 'annotations'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %s SET SCHEMA annotations_repartition', part.rel);
    END LOOP;
    ALTER TABLE annotations SET SCHEMA annotations_repartition;

    -- Recreate table partitioned by time
    CREATE TABLE annotations (
        LIKE annotations_repartition.annotations INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
        PRIMARY KEY (namespace, name, time)
    ) PARTITION BY RANGE (time);

    -- Re-create existing weekly partitions in the new table
    FOR week_start IN
        SELECT DISTINCT date_trunc('week', to_timestamp(time / 1000.0) AT TIME ZONE 'UTC')
        FROM annotations_repartition.annotations
    LOOP
        EXECUTE format('CREATE TABLE %I PARTITION OF annotations FOR VALUES FROM (%s) TO (%s)',
            'annotations_' || to_char(week_start, 'IYYY"w"IW'),
            (extract(epoch FROM week_start) * 1000)::bigint,
            (extract(epoch FROM week_start + interval '7 days') * 1000)::bigint);
    END LOOP;

    -- Copy data from the old tables to new tables and drop the old tables
    INSERT INTO annotations SELECT * FROM annotations_repartition.annotations;
    DROP SCHEMA annotations_repartition CASCADE;
END $$;
-- +goose StatementEnd

-- Recreate indexes
CREATE INDEX idx_ns_time_end ON annotations (namespace, time_end DESC, time DESC, name);
CREATE INDEX idx_dashboard_time_end ON annotations (namespace, dashboard_uid, time_end DESC, time DESC, name);
CREATE INDEX idx_tags ON annotations USING GIN (namespace, tags);
CREATE INDEX idx_scopes ON annotations USING GIN (namespace, scopes);
CREATE INDEX idx_legacy_id ON annotations (namespace, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX idx_legacy_migrated ON annotations (namespace) WHERE legacy_migrated;
