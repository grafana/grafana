-- SELECT $__timeGroupAlias("time",5m,27),c,avg(v) AS "v" FROM tbl GROUP BY 1,2 ORDER BY 1,2
-- tests fill-mode=value
CREATE TABLE tbl (
    `time` timestamp NOT NULL,
    v double precision,
    c text
);

INSERT INTO tbl (`time`, v, c) VALUES
('2023-12-24 14:21:03+00:00', 10, 'a'),
('2023-12-24 14:21:03+00:00', 110, 'b'),
('2023-12-24 14:23:03+00:00', 20, 'a'),
('2023-12-24 14:23:03+00:00', 120, 'b'),
('2023-12-24 14:39:03+00:00', 50, 'a'),
('2023-12-24 14:39:03+00:00', 150, 'b');