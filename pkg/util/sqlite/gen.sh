#!/bin/sh
$GOBIN/ccgo \
	--package-name cc \
	--prefix-enumerator=_ \
	--prefix-external=x_ \
	--prefix-field=F \
	--prefix-static-internal=_ \
	--prefix-static-none=_ \
	--prefix-tagged-enum=_ \
	--prefix-tagged-struct=T \
	--prefix-tagged-union=T \
	--prefix-typename=T \
	--prefix-undefined=_ \
	-ignore-unsupported-alignment \
	-DLONGDOUBLE_TYPE=double \
	-DNDEBUG \
	-DSQLITE_THREADSAFE=1 \
	-DSQLITE_ENABLE_RTREE \
	-DHAVE_USLEEP=1 \
	-DSQLITE_ENABLE_FTS3 \
	-DSQLITE_ENABLE_FTS3_PARENTHESIS \
	-DSQLITE_OMIT_DEPRECATED \
	-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 \
	-DSQLITE_ENABLE_UPDATE_DELETE_LIMIT=1 \
	-DSQLITE_WITHOUT_ZONEMALLOC \
	-Dpread64=pread \
	-Dpwrite64=pwrite \
	-extended-errors \
	-o cc/sqlite3_binding.go \
	sqlite3-binding.c \
	-eval-all-macros

gsed -i 's/\<T__\([a-zA-Z0-9][a-zA-Z0-9_]\+\)/t__\1/g' cc/sqlite3_binding.go
gsed -i 's/\<x_\([a-zA-Z0-9][a-zA-Z0-9_]\+\)/X\1/g' cc/sqlite3_binding.go
