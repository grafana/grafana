package parse

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"
)

func isValid(fname string, t *testing.T) (bool, error) {
	b, err := ioutil.ReadFile(fname)
	if err != nil {
		return false, nil
	}
	_, err = Parse(fname, string(b))
	return err == nil, err
}

func testDir(dirname string, valid bool, t *testing.T) {
	files, _ := ioutil.ReadDir(dirname)
	for _, f := range files {
		p := filepath.Join(dirname, f.Name())
		if got, err := isValid(p, t); valid != got {
			t.Fatalf("%v: expected %v: %v", p, valid, err)
		}
	}
}

func TestLex(t *testing.T) {
	testDir("test_valid", true, t)
	testDir("test_invalid", false, t)
}

func _TestPrint(t *testing.T) {
	fname := "test_valid/4"
	b, err := ioutil.ReadFile(fname)
	if err != nil {
		t.Fatal(err)
	}
	c, err := Parse(fname, string(b))
	if err != nil {
		t.Error(err)
	} else {
		fmt.Print(c.Root)
	}
}
