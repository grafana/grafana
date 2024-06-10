-- SELECT * FROM tbl
-- there's special backward-compat code which handles a field named 'metric'
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v double precision,
    metric text
);

INSERT INTO tbl ("time", v, metric) VALUES
('2023-12-24 14:30:03 UTC', 10, 'a'),
('2023-12-24 14:30:03 UTC', 110, 'b'),
('2023-12-24 14:31:03 UTC', 20, 'a'),
('2023-12-24 14:31:03 UTC', 120, 'b'),
('2023-12-24 14:32:03 UTC', 30, 'a'),
('2023-12-24 14:32:03 UTC', 130, 'b'),
('2023-12-24 14:33:03 UTC', 40, 'a'),
('2023-12-24 14:33:03 UTC', 140, 'b'),
('2023-12-24 14:34:03 UTC', 50, 'a'),
('2023-12-24 14:34:03 UTC', 150, 'b');