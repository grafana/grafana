go-sqlite3
==========

[![Build Status](https://travis-ci.org/mattn/go-sqlite3.png?branch=master)](https://travis-ci.org/mattn/go-sqlite3)
[![Coverage Status](https://coveralls.io/repos/mattn/go-sqlite3/badge.png?branch=master)](https://coveralls.io/r/mattn/go-sqlite3?branch=master)

Description
-----------

sqlite3 driver conforming to the built-in database/sql interface

Installation
------------

This package can be installed with the go get command:

    go get github.com/mattn/go-sqlite3
    
Documentation
-------------

API documentation can be found here: http://godoc.org/github.com/mattn/go-sqlite3

Examples can be found under the `./_example` directory

FAQ
---

* Can't build go-sqlite3 on windows 64bit.

    > Probably, you are using go 1.0, go1.0 has a problem when it comes to compiling/linking on windows 64bit. 
    > See: https://github.com/mattn/go-sqlite3/issues/27

* Getting insert error while query is opened.

    > You can pass some arguments into the connection string, for example, a URI.
    > See: https://github.com/mattn/go-sqlite3/issues/39

* Do you want cross compiling? mingw on Linux or Mac?

    > See: https://github.com/mattn/go-sqlite3/issues/106
    > See also: http://www.limitlessfx.com/cross-compile-golang-app-for-windows-from-linux.html

License
-------

MIT: http://mattn.mit-license.org/2012

sqlite.c, sqlite3.h, sqlite3ext.h

In this repository, those files are amalgamation code that copied from SQLite3. The license of those codes are depend on the license of SQLite3.

Author
------

Yasuhiro Matsumoto (a.k.a mattn)
