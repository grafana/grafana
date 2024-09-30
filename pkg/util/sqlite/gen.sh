#!/bin/sh

gen() {
	TARGET_OS="$1"
	TARGET_ARCH="$2"
	OUT="cc/sqlite3_binding_${TARGET_OS}_${TARGET_ARCH}.go"
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
		-o "$OUT" \
		sqlite3-binding.c \
		-eval-all-macros

	gsed -i 's/\<T__\([a-zA-Z0-9][a-zA-Z0-9_]\+\)/t__\1/g' "$OUT"
	gsed -i 's/\<x_\([a-zA-Z0-9][a-zA-Z0-9_]\+\)/X\1/g' "$OUT"
}

gen darwin amd64
gen darwin arm64
gen linux arm64
gen linux amd64
