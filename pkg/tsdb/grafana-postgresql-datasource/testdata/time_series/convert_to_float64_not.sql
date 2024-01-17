-- SELECT * FROM tbl
-- in timeseries mode, most fields gets converted to float64, but text-fields should stay text
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v double precision NOT NULL,
    c1 text,
    c1nn text NOT NULL,
    c2 varchar(10),
    c2nn varchar(10) NOT NULL,
    c3 char(10),
    c3nn char(10) NOT NULL
);

INSERT INTO tbl ("time",
v,
c1, c1nn, c2, c2nn, c3, c3nn) VALUES
('2023-12-21 11:30:03 UTC',
10.1,
'one', 'two', 'three', 'four', 'five', 'six'),
('2023-12-21 11:31:03 UTC',
20.1,
NULL, 'twelve', NULL, 'fourteen', NULL, 'sixteen');