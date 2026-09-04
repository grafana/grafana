-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN
        SELECT child.relname
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relname = 'annotations'
    LOOP
        -- time_end is populated on every row now, so the old partial predicate
        -- no longer narrows anything; widen to a plain index.
        EXECUTE format('DROP INDEX IF EXISTS idx_time_end_%s', partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_time_end_%s ON %I (namespace, time_end)', partition_name, partition_name);
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
DECLARE
    partition_name text;
BEGIN
    FOR partition_name IN
        SELECT child.relname
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relname = 'annotations'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS idx_time_end_%s', partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_time_end_%s ON %I (namespace, time_end) WHERE time_end IS NOT NULL', partition_name, partition_name);
    END LOOP;
END $$;
-- +goose StatementEnd
