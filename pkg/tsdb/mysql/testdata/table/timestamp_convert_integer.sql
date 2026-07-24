-- SELECT * FROM tbl
-- the time-field and time-end field gets converted to time.Time
CREATE TABLE tbl (
    -- note, in the timestmap below we must say `NULL` otherwise mysql-below-8 inserts current timestamp
    reallyt timestamp(6) NULL, -- reference real timestamp
    "time" integer, -- 32bits, seconds-as-number is highest we can go, milliseconds-as-number does not fit
    n integer, -- normal number, it should not get converted to a timestamp
    timeend integer
);

INSERT INTO tbl (reallyt, "time", n, timeend) VALUES
('2023-12-21T12:21:27 UTC', 1703161287, 1703161287, 1703161312),
(NULL, NULL, NULL, NULL);