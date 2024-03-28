-- SELECT * FROM tbl WHERE false
CREATE TABLE tbl (
    `time` timestamp NOT NULL,
    v1 double precision,
    v2 double precision
);

INSERT INTO tbl (`time`, v1, v2) VALUES
('2023-12-24 14:30:03+00:00', 10, 110),
('2023-12-24 14:31:03+00:00', 20, 120);