// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package arrio exposes functions to manipulate records, exposing and using
// interfaces not unlike the ones defined in the stdlib io package.
package arrio // import "github.com/apache/arrow/go/arrow/arrio"

import (
	"io"

	"github.com/apache/arrow/go/arrow/array"
)

// Reader is the interface that wraps the Read method.
type Reader interface {
	// Read reads the current record from the underlying stream and an error, if any.
	// When the Reader reaches the end of the underlying stream, it returns (nil, io.EOF).
	Read() (array.Record, error)
}

// ReaderAt is the interface that wraps the ReadAt method.
type ReaderAt interface {
	// ReadAt reads the i-th record from the underlying stream and an error, if any.
	ReadAt(i int64) (array.Record, error)
}

// Writer is the interface that wraps the Write method.
type Writer interface {
	Write(rec array.Record) error
}

// Copy copies all the records available from src to dst.
// Copy returns the number of records copied and the first error
// encountered while copying, if any.
//
// A successful Copy returns err == nil, not err == EOF. Because Copy is
// defined to read from src until EOF, it does not treat an EOF from Read as an
// error to be reported.
func Copy(dst Writer, src Reader) (n int64, err error) {
	for {
		rec, err := src.Read()
		if err != nil {
			if err == io.EOF {
				return n, nil
			}
			return n, err
		}
		err = dst.Write(rec)
		if err != nil {
			return n, err
		}
		n++
	}
}

// CopyN copies n records (or until an error) from src to dst. It returns the
// number of records copied and the earliest error encountered while copying. On
// return, written == n if and only if err == nil.
func CopyN(dst Writer, src Reader, n int64) (written int64, err error) {
	for ; written < n; written++ {
		rec, err := src.Read()
		if err != nil {
			if err == io.EOF && written == n {
				return written, nil
			}
			return written, err
		}
		err = dst.Write(rec)
		if err != nil {
			return written, err
		}
	}

	if written != n && err == nil {
		err = io.EOF
	}
	return written, err
}
