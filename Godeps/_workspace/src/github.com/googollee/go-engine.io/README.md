# go-engine.io

[![GoDoc](http://godoc.org/github.com/googollee/go-engine.io?status.svg)](http://godoc.org/github.com/googollee/go-engine.io) [![Build Status](https://travis-ci.org/googollee/go-engine.io.svg)](https://travis-ci.org/googollee/go-engine.io)

go-engine.io is the implement of engine.io in golang, which is transport-based cross-browser/cross-device bi-directional communication layer for [go-socket.io](https://github.com/googollee/go-socket.io).

It is compatible with node.js implement, and supported long-polling and websocket transport.

## Install

Install the package with:

```bash
go get github.com/googollee/go-engine.io
```

Import it with:

```go
import "github.com/googollee/go-engine.io"
```

and use `engineio` as the package name inside the code.

## Example

Please check example folder for details.

```go
package main

import (
	"encoding/hex"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/googollee/go-engine.io"
)

func main() {
	server, err := engineio.NewServer(nil)
	if err != nil {
		log.Fatal(err)
	}

	go func() {
		for {
			conn, _ := server.Accept()
			go func() {
				defer conn.Close()
				for i := 0; i < 10; i++ {
					t, r, _ := conn.NextReader()
					b, _ := ioutil.ReadAll(r)
					r.Close()
					if t == engineio.MessageText {
						log.Println(t, string(b))
					} else {
						log.Println(t, hex.EncodeToString(b))
					}
					w, _ := conn.NextWriter(t)
					w.Write([]byte("pong"))
					w.Close()
				}
			}()
		}
	}()

	http.Handle("/engine.io/", server)
	http.Handle("/", http.FileServer(http.Dir("./asset")))
	log.Println("Serving at localhost:5000...")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
```

## License

The 3-clause BSD License  - see LICENSE for more details