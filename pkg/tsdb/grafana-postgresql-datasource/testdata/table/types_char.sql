-- SELECT * FROM tbl
-- test all character-based postgres data types
CREATE TEMPORARY TABLE tbl (
    cv character varying(10),
    cvnn character varying(10) NOT NULL,
    c character(10),
    cnn character(10) NOT NULL,
    bpc bpchar,
    bpcnn bpchar NOT NULL,
    t text,
    tnn text NOT NULL
);

INSERT INTO tbl (cv, cvnn, c, cnn, bpc, bpcnn,  t, tnn) VALUES
('one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'),
(NULL, 'xtwo', NULL, 'xfour', NULL, 'xsix', NULL, 'xeight');