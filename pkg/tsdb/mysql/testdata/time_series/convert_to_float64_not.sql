-- SELECT * FROM tbl
-- in timeseries mode, most fields gets converted to float64, but text-fields should stay text
CREATE TABLE tbl (
    "time" timestamp NOT NULL,
    v double precision NOT NULL,
    c1 varchar(10),
    c1nn varchar(10) NOT NULL,
    c2 char(10),
    c2nn char(10) NOT NULL,
    c3 tinytext,
    c3nn tinytext NOT NULL,
    c4 text,
    c4nn text NOT NULL,
    c5 mediumtext,
    c5nn mediumtext NOT NULL,
    c6 longtext,
    c6nn longtext NOT NULL,
    c7 enum('v1', 'v2'),
    c7nn enum('v1', 'v2') NOT NULL
);

INSERT INTO tbl ("time",
v,
c1, c1nn, c2, c2nn, c3, c3nn, c4, c4nn, c5, c5nn, c6, c6nn, c7, c7nn) VALUES
('2023-12-21 11:30:03 UTC',
10.1,
'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'v1', 'v2'),
('2023-12-21 11:31:03 UTC',
20.1,
NULL, 'bb', NULL, 'dd', NULL, 'ff', NULL, 'hh', NULL, 'jj', NULL, 'll', NULL, 'v1');