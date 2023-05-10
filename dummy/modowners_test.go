package main

import "testing"

func TestCommonElement(t *testing.T) {
	if hasCommonElement([]string{}, []string{}) == true {
		t.Error("should not return true")
	}
	if hasCommonElement([]string{"a", "b"}, []string{"c"}) == true {
		t.Error("should not return true")
	}
	if hasCommonElement([]string{"a"}, []string{"a"}) == false {
		t.Error("should not return false")
	}
}
