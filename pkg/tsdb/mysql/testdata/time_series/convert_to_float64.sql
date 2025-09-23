-- SELECT * FROM tbl
-- in timeseries mode, most fields gets converted to float64
CREATE TABLE tbl (
    "time" timestamp NOT NULL,
    v1 double precision,
    v1nn double precision NOT NULL,
    v2 float,
    v2nn float NOT NULL,
    t text,
    x1 tinyint,
    x1nn tinyint NOT NULL,
    x2 smallint,
    x2nn smallint NOT NULL,
    x3 mediumint,
    x3nn mediumint NOT NULL,
    x4 integer,
    x4nn integer NOT NULL,
    x5 bigint,
    x5nn bigint NOT NULL
);

INSERT INTO tbl ("time",
v1, v1nn, v2, v2nn,
t,
x1, x1nn, x2, x2nn, x3, x3nn, x4, x4nn, x5, x5nn) VALUES
('2023-12-21 11:30:03 UTC',
3.78125, 451.5625, 52.25, 511.3125,
'one',
101, 102, 103, 104, 105, 106, 107, 108, 109, 110),
('2023-12-21 11:31:03 UTC',
NULL, 464.375, NULL, 346.125,
'one',
NULL, 202, NULL, 204, NULL, 206, NULL, 208, NULL, 210);