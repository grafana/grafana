-- SELECT * FROM tbl
-- test all date/time-based postgres data types
CREATE TEMPORARY TABLE tbl (
    ts timestamp,
    tsnn timestamp NOT NULL,
    tsz timestamp with time zone,
    tsznn timestamp with time zone NOT NULL,
    d date,
    dnn date NOT NULL,
    t time,
    tnn time NOT NULL,
    tz time with time zone,
    tznn time with time zone NOT NULL,
    i interval,
    inn interval NOT NULL
);

INSERT INTO tbl (ts, tsnn, tsz, tsznn, d, dnn, t, tnn, tz, tznn, i, inn) VALUES (
'2023-11-15 05:06:07.123456',
'2023-11-15 05:06:08.123456',
'2021-07-22 13:22:33.654321 Europe/Berlin',
'2021-07-22 13:22:34.654321 Europe/Berlin',
'2023-12-20',
'2023-12-21',
'12:34:56.234567',
'12:34:57.234567',
'23:12:36.765432+1',
'23:12:37.765432+1',
'987654 microsecond',
'887654 microsecond'
), (
NULL,
'2023-11-15 05:06:09.123456',
NULL,
'2021-07-22 13:22:35.654321 Europe/Berlin',
NULL,
'2023-12-22',
NULL,
'12:34:58.234567',
NULL,
'23:12:38.765432+1',
NULL,
'787654 microsecond'
);