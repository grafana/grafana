## go-snappystream

a Go package for framed snappy streams.

[![Build Status](https://secure.travis-ci.org/mreiferson/go-snappystream.png?branch=master)](http://travis-ci.org/mreiferson/go-snappystream) [![GoDoc](https://godoc.org/github.com/mreiferson/go-snappystream?status.svg)](https://godoc.org/github.com/mreiferson/go-snappystream)

This package wraps [snappy-go][1] and supplies a `Reader` and `Writer` 
for the snappy [framed stream format][2].

[1]: https://code.google.com/p/snappy-go/
[2]: https://snappy.googlecode.com/svn/trunk/framing_format.txt
