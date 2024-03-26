-- SELECT $__timeGroup("t",5m,NULL) ,avg(v) FROM tbl GROUP BY 1
-- we change behavior based on what follows the timegroup, see:
-- https://github.com/grafana/grafana/blob/0b4c81158ea32a671e7788b888b086082343407c/pkg/tsdb/grafana-postgresql-datasource/macros.go#L36
CREATE TEMPORARY TABLE tbl (
    t timestamp with time zone,
    v double precision
);

INSERT INTO tbl (t, v) VALUES
('2023-12-24 14:30:03 UTC', 42);