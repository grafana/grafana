-- SELECT $__timeGroup("time",5m,previous),c,avg(v) AS "v" FROM tbl GROUP BY 1,2 ORDER BY 1,2
-- tests fill-mode=previous
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v double precision,
    c text
);

INSERT INTO tbl ("time", v, c) VALUES
('2023-12-24 14:21:03 UTC', 10, 'a'),
('2023-12-24 14:21:03 UTC', 110, 'b'),
('2023-12-24 14:23:03 UTC', 20, 'a'),
('2023-12-24 14:23:03 UTC', 120, 'b'),
('2023-12-24 14:39:03 UTC', 50, 'a'),
('2023-12-24 14:39:03 UTC', 150, 'b');