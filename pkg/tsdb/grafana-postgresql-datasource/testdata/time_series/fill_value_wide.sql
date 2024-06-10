-- SELECT $__timeGroup("time",5m,27),avg(v1) AS "v1", avg(v2) AS "v2" FROM tbl GROUP BY 1 ORDER BY 1
-- tests fill-mode=value
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v1 double precision,
    v2 double precision
);

INSERT INTO tbl ("time", v1, v2) VALUES
('2023-12-24 14:21:03 UTC', 10, 110),
('2023-12-24 14:23:03 UTC', 20, 120),
('2023-12-24 14:39:03 UTC', 50, 150);