-- SELECT * FROM tbl
-- the time-field and time-end field gets converted to time.Time
CREATE TEMPORARY TABLE tbl (
    reallyt timestamp with time zone, -- reference real timestamp
    "time" integer, -- 32bits, seconds-as-number is highest we can go, milliseconds-as-number does not fit
    n integer, -- normal number, it should not get converted to a timestamp
    timeend integer
);

INSERT INTO tbl (reallyt, "time", n, timeend) VALUES
('2023-12-21T12:21:27 UTC', 1703161287, 1703161287, 1703161312),
(NULL, NULL, NULL, NULL);