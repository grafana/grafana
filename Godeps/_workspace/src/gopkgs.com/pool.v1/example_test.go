package pool_test

import (
	"fmt"

	"gopkgs.com/pool.v1"
)

func ExamplePool() {
	p := pool.New(0)
	p.Put("Hello")
	fmt.Println(p.Get())
	// OutPut: Hello
}

func ExamplePoolNew() {
	p := pool.New(0)
	p.New = func() interface{} {
		return "World!"
	}
	fmt.Println(p.Get())
	// OutPut: World!
}
