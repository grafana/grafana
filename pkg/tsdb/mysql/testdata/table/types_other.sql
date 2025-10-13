-- SELECT * FROM tbl
-- test the less used mysql data types
CREATE TABLE tbl (
    tb tinyblob,
    tbnn tinyblob NOT NULL,
    b blob,
    bnn blob NOT NULL,
    mb mediumblob,
    mbnn mediumblob NOT NULL,
    lb longblob,
    lbnn longblob NOT NULL,
    bt bit(1),
    btnn bit(1) NOT NULL
);

INSERT INTO tbl (tb, tbnn, b, bnn, mb, mbnn, lb, lbnn, bt, btnn) VALUES
(
    UNHEX('4141'),
    UNHEX('4142'),
    UNHEX('4143'),
    UNHEX('4144'),
    UNHEX('4145'),
    UNHEX('4146'),
    UNHEX('4147'),
    UNHEX('4148'),
    b'0',
    b'1'
),
(
    NULL,
    UNHEX('4242'),
    NULL,
    UNHEX('4244'),
    NULL,
    UNHEX('4246'),
    NULL,
    UNHEX('4248'),
    NULL,
    b'0'
);