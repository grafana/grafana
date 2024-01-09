-- SELECT * FROM tbl
-- in timeseries mode, most fields gets converted to float6
CREATE TEMPORARY TABLE tbl (
    "time" timestamp with time zone,
    v1 double precision,
    v1nn double precision NOT NULL,
    v2 real,
    v2nn real NOT NULL,
    c1 text,
    c1nn text NOT NULL,
    c2 varchar(10),
    c2nn varchar(10) NOT NULL,
    c3 char(10),
    c3nn char(10) NOT NULL,
    x1 smallint,
    x1nn smallint NOT NULL,
    x2 integer,
    x2nn integer NOT NULL,
    x3 bigint,
    x3nn bigint NOT NULL
);

INSERT INTO tbl ("time",
v1, v1nn, v2, v2nn,
c1, c1nn, c2, c2nn, c3, c3nn,
x1, x1nn, x2, x2nn, x3, x3nn) VALUES
('2023-12-21 11:30:03 UTC',
10.1, 11.1, 12.1, 13.1,
'one', 'two', 'three', 'four', 'five', 'six',
101, 102, 103, 104, 105, 106);