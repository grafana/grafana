-- SELECT * FROM tbl
-- test all numeric postgres data types
CREATE TEMPORARY TABLE tbl (
    i16 smallint,
    i16nn smallint NOT NULL,
    i32 integer,
    i32nn integer NOT NULL,
    i64 bigint,
    i64nn bigint NOT NULL,
    n numeric(7, 2),
    nnn numeric(7,2) NOT NULL,
    f32 real,
    f32nn real NOT NULL,
    f64 double precision,
    f64nn double precision NOT NULL
);

INSERT INTO tbl (i16, i16nn, i32, i32nn, i64, i64nn, n, nnn, f32, f32nn, f64, f64nn) VALUES
(1, 2, 3, 4, 5, 6, 81.75, 7065.25, 30.75, 14.625, 21.5625, 14.25),
(NULL, 22, NULL, 44, NULL, 66, NULL, 169.75, NULL, 77.125, NULL, 215.8125);