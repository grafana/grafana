-- SELECT t FROM tbl WHERE t='one'; SELECT t FROM tbl WHERE t='three';
-- lib/pq allows multiple queries to run, and return results for all the queries
CREATE TEMPORARY TABLE tbl (
    t text
);

INSERT INTO tbl (t) VALUES ('one'),('two'),('three');