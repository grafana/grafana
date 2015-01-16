// Copyright (C) 2014 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

/*
#cgo CFLAGS: -I. -fno-stack-check -fno-stack-protector -mno-stack-arg-probe
#cgo windows,386 CFLAGS: -D_localtime32=localtime
#cgo LDFLAGS: -lmingwex -lmingw32
#cgo CFLAGS: -DSQLITE_ENABLE_RTREE -DSQLITE_THREADSAFE
*/
import "C"
