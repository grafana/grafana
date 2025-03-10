package assert

import "fmt"

func True(expr bool, msg string, args ...any) {
	if !expr {
		if len(args) > 0 {
			panic(fmt.Sprintf(msg, args...))
		} else {
			panic(msg)
		}
	}
}
