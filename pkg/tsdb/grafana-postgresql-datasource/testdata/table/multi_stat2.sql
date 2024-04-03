-- SET TIME ZONE -7; select * from tbl; SET TIME ZONE DEFAULT; select * from tbl;
-- the multiple statements can affect each other, their order must be correct.
CREATE TEMPORARY TABLE tbl (
    d timestamp with time zone
);

INSERT INTO tbl (d) VALUES ('2024-04-03T12:43:25UTC')