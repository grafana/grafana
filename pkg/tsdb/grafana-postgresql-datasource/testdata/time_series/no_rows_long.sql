-- SELECT * FROM tbl WHERE false
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v double precision,
    c text
);

INSERT INTO tbl ("time", v, c) VALUES
('2023-12-24 14:30:03 UTC', 10, 'a'),
('2023-12-24 14:30:03 UTC', 110, 'b'),
('2023-12-24 14:31:03 UTC', 20, 'a'),
('2023-12-24 14:31:03 UTC', 120, 'b');