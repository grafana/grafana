-- SELECT * FROM tbl
-- test the less used postgres data types
CREATE TEMPORARY TABLE tbl (
    m money,
    mnn money NOT NULL,
    bt bytea,
    btnn bytea NOT NULL,
    bl boolean,
    blnn boolean NOT NULL
);

INSERT INTO tbl (m, mnn, bt, btnn, bl, blnn) VALUES
(12.34, 23.45, '\x41424344'::bytea, '\x45464748'::bytea, TRUE, TRUE),
(12.34, 23.45, '\x51525354'::bytea, '\x55565758'::bytea, FALSE, FALSE),
(NULL, 34.56, NULL, '\x61626364'::bytea, NULL, TRUE);