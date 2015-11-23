package gou

import (
	"testing"
)

func TestUid(t *testing.T) {
	u := NewUid()
	Debug(u)
	Debug(NewUid())
}
