# socket.io

[![GoDoc](http://godoc.org/github.com/googollee/go-socket.io?status.svg)](http://godoc.org/github.com/googollee/go-socket.io) [![Build Status](https://travis-ci.org/googollee/go-socket.io.svg)](https://travis-ci.org/googollee/go-socket.io)

go-socket.io is the implement of [socket.io](http://socket.io) in golang, which is a realtime application framework.

It compatible with latest implement of socket.io in node.js, and support room and namespace.

* for compatible with socket.io 0.9.x, please use branch 0.9.x *

## Install

Install the package with:

```bash
go get github.com/googollee/go-socket.io
```

Import it with:

```go
import "github.com/googollee/go-socket.io"
```

and use `socketio` as the package name inside the code.

## Example

Please check example folder for details.

```go
package main

import (
	"log"
	"net/http"

	"github.com/googollee/go-socket.io"
)

func main() {
	server, err := socketio.NewServer(nil)
	if err != nil {
		log.Fatal(err)
	}
	server.On("connection", func(so socketio.Socket) {
		log.Println("on connection")
		so.Join("chat")
		so.On("chat message", func(msg string) {
			log.Println("emit:", so.Emit("chat message", msg))
			so.BroadcastTo("chat", "chat message", msg)
		})
		so.On("disconnection", func() {
			log.Println("on disconnect")
		})
	})
	server.On("error", func(so socketio.Socket, err error) {
		log.Println("error:", err)
	})

	http.Handle("/socket.io/", server)
	http.Handle("/", http.FileServer(http.Dir("./asset")))
	log.Println("Serving at localhost:5000...")
	log.Fatal(http.ListenAndServe(":5000", nil))
}
```

## License

The 3-clause BSD License  - see LICENSE for more details
