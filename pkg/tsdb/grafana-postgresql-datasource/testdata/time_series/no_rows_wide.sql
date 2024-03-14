-- SELECT * FROM tbl WHERE false
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v1 double precision,
    v2 double precision
);

INSERT INTO tbl ("time", v1, v2) VALUES
('2023-12-24 14:30:03 UTC', 10, 110),
('2023-12-24 14:31:03 UTC', 20, 120);