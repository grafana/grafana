# bpool [![GoDoc](https://godoc.org/github.com/oxtoacart/bpool?status.png)](https://godoc.org/github.com/oxtoacart/bpool)

Package bpool implements leaky pools of byte arrays and Buffers as bounded channels. It is based on the leaky buffer example from the Effective Go documentation: http://golang.org/doc/effective_go.html#leaky_buffer

## Install

`go get github.com/oxtoacart/bpool`

## Documentation

See [godoc.org](http://godoc.org/github.com/oxtoacart/bpool) or use `godoc github.com/oxtoacart/bpool`

## Example

```go

var bufpool *bpol.BufferPool

func main() {

    bufpool = bpool.NewBufferPool(48)

}

func someFunction() error {

     // Get a buffer from the pool
     buf := bufpool.Get()
     ...
     ...
     ...
     // Return the buffer to the pool
     bufpool.Put(buf)
     
     return nil
}
```
