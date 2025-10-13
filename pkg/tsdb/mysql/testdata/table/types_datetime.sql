-- SELECT * FROM tbl
-- test all date/time-based postgres data types
CREATE TABLE tbl (
    ts timestamp NULL, -- must say `NULL` for below mysql8, see (explicit_defaults_for_timestamp)
    tsnn timestamp NOT NULL,
    ts6 timestamp(6) NULL, -- must say `NULL` for below mysql8, see (explicit_defaults_for_timestamp)
    ts6nn timestamp(6) NOT NULL,
    dt datetime,
    dtnn datetime NOT NULL,
    dt6 datetime(6),
    dt6nn datetime(6) NOT NULL,
    d date,
    dnn date NOT NULL,
    t time,
    tnn time NOT NULL,
    t6 time(6),
    t6nn time(6) NOT NULL,
    y year,
    ynn year NOT NULL
);

INSERT INTO tbl (ts, tsnn, ts6, ts6nn, dt, dtnn, dt6, dt6nn, d, dnn, t, tnn, t6, t6nn, y, ynn) VALUES (
'2023-11-15 05:06:07+00:00',
'2023-11-15 05:06:08+00:00',
'2021-07-22 13:22:33.654321+00:00',
'2021-07-22 13:22:34.654321+00:00',
'2023-11-15 06:06:07+00:00',
'2023-11-15 06:06:08+00:00',
'2021-07-22 14:22:33.654321+00:00',
'2021-07-22 14:22:34.654321+00:00',
'2023-12-20',
'2023-12-21',
'12:34:56',
'12:34:57',
'12:44:56.234567',
'12:44:57.234567',
'2022',
'2023'
), (
NULL,
'2023-11-15 05:06:09+00:00',
NULL,
'2021-07-22 13:22:35.654321+00:00',
NULL,
'2023-11-16 05:06:09+00:00',
NULL,
'2021-07-23 13:22:35.654321+00:00',
NULL,
'2023-12-22',
NULL,
'12:34:58',
NULL,
'12:44:58.234567',
NULL,
'2024'
);