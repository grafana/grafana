-- SELECT * FROM tbl
-- test all character-based mysql data types
CREATE TABLE tbl (
    vc varchar(10),
    vcnn varchar(10) NOT NULL,
    c char(10),
    cnn char(10) NOT NULL,
    tt tinytext,
    ttnn tinytext NOT NULL,
    t text,
    tnn text NOT NULL,
    mt mediumtext,
    mtnn mediumtext NOT NULL,
    lt longtext,
    ltnn longtext NOT NULL,
    e enum('v1', 'v2'),
    enn enum('v1', 'v2') NOT NULL,
    s set('a', 'b', 'c'),
    snn set('a', 'b', 'c') NOT NULL
);

INSERT INTO tbl (vc, vcnn, c, cnn, tt, ttnn, t, tnn, mt, mtnn, lt, ltnn, e, enn, s, snn) VALUES
('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'v1', 'v2', 'a,b', ''),
(NULL, 'xtwo', NULL, 'xfour', NULL, 'xsix', NULL, 'xeight' , NULL, 'xten', NULL, 'xtwelve', NULL, 'v1', NULL, 'a,c');