package core

import (
	"fmt"
	"testing"
)

func TestPK(t *testing.T) {
	p := NewPK(1, 3, "string")
	str, err := p.ToString()
	if err != nil {
		t.Error(err)
	}
	fmt.Println(str)

	s := &PK{}
	err = s.FromString(str)
	if err != nil {
		t.Error(err)
	}
	fmt.Println(s)
}
