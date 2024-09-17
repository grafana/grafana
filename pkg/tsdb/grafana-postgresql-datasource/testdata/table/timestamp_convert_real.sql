-- SELECT * FROM tbl
-- the time-field and time-end field gets converted to time.Time
CREATE TEMPORARY TABLE tbl (
    reallyt timestamp with time zone, -- reference real timestamp
    "time" real,
    n real, -- normal number, it should not get converted to a timestamp
    timeend bigint
);

INSERT INTO tbl (reallyt, "time", n, timeend) VALUES
('2023-12-21T12:22:24', 1703161344, 1703161344, 1703161372),
('2023-12-21T12:20:33.408', 1703161233408, 1703161233408, 1703161312522),
('2023-12-21T12:20:41.050022', 1703161241050021888, 1703161241050021888, 1703161312522186000),
(NULL, NULL, NULL, NULL);