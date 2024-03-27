-- SELECT * FROM tbl
-- the time-field and time-end field gets converted to time.Time
CREATE TABLE tbl (
    -- note, in the timestmap below we must say `NULL` otherwise mysql-below-8 inserts current timestamp
    reallyt timestamp(6) NULL, -- reference real timestamp
    "time" double precision,
    n double precision, -- normal number, it should not get converted to a timestamp
    timeend bigint
);

INSERT INTO tbl (reallyt, "time", n, timeend) VALUES
('2023-12-21T12:21:27 UTC', 1703161287, 1703161287, 1703161312),
('2023-12-21T12:21:27.724 UTC', 1703161287724, 1703161287724, 1703161312522),
('2023-12-21T12:21:27.724919 UTC', 1703161287724919000, 1703161287724919000, 1703161312522186000),
(NULL, NULL, NULL, NULL);