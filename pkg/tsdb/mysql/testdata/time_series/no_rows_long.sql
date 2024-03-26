-- SELECT * FROM tbl WHERE false
CREATE TABLE tbl (
    `time` timestamp NOT NULL,
    v double precision,
    c text
);

INSERT INTO tbl (`time`, v, c) VALUES
('2023-12-24 14:30:03+00:00', 10, 'a'),
('2023-12-24 14:30:03+00:00', 110, 'b'),
('2023-12-24 14:31:03+00:00', 20, 'a'),
('2023-12-24 14:31:03+00:00', 120, 'b');