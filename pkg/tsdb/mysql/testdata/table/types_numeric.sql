-- SELECT * FROM tbl
-- test all numeric mysql data types
CREATE TABLE tbl (
    i8 tinyint,
    i8nn tinyint NOT NULL,
    i16 smallint,
    i16nn smallint NOT NULL,
    i24 mediumint,
    i24nn mediumint NOT NULL,
    i32 integer,
    i32nn integer NOT NULL,
    i64 bigint,
    i64nn bigint NOT NULL,
    d decimal(7, 2),
    dnn decimal(7,2) NOT NULL,
    f32 float,
    f32nn float NOT NULL,
    f64 double precision,
    f64nn double precision NOT NULL
);

INSERT INTO tbl (i8, i8nn, i16, i16nn, i24, i24nn, i32, i32nn, i64, i64nn, d, dnn, f32, f32nn, f64, f64nn) VALUES
(-5, -4, 1, 2, 3, 4, 5, 6, 7, 8,  81.75, 7065.25, 30.75, 14.625, 21.5625, 14.25),
(NULL, -44, NULL, 22, NULL, 44, NULL, 66, NULL, 88, NULL, 169.75, NULL, 77.125, NULL, 215.8125);