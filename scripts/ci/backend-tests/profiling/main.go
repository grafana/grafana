package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: profiling <summarize|report> [args]")
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "summarize":
		err = summarize(os.Args[2:])
	case "report":
		err = report(os.Args[2:])
	default:
		err = fmt.Errorf("unknown command %q", os.Args[1])
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
