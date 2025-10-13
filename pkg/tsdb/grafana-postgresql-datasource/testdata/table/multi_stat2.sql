-- SET TIME ZONE -7; select * from tbl; SET TIME ZONE DEFAULT; select * from tbl;
-- we are testing that you can run multiple statements in one "query",
-- and those statements have effects on each other, in this example
-- we load the same database-value in different time-zones,
-- we should receive different values.
CREATE TEMPORARY TABLE tbl (
    d timestamp with time zone
);

INSERT INTO tbl (d) VALUES ('2024-04-03T12:43:25UTC')