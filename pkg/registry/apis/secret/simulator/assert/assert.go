package assert

import (
	"errors"
	"fmt"
)

func True(expr bool, msg string, args ...any) {
	if !expr {
		if len(args) > 0 {
			panic(fmt.Sprintf(msg, args...))
		} else {
			panic(msg)
		}
	}
}

func ErrorIs(err1, err2 error) {
	if !errors.Is(err1, err2) {
		panic(fmt.Sprintf("expected error %T%+v to be %T%+v", err1, err1, err2, err2))
	}
}
