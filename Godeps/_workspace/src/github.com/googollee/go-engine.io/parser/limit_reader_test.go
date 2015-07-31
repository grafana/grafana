package parser

import (
	"bytes"
	"errors"
	"io"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestLimitReader(t *testing.T) {

	Convey("Read to limit", t, func() {
		b := bytes.NewBufferString("1234567890")
		r := newLimitReader(b, 5)
		p := make([]byte, 1024)
		n, err := r.Read(p)
		So(err, ShouldBeNil)
		So(string(p[:n]), ShouldEqual, "12345")
		n, err = r.Read(p)
		So(err, ShouldEqual, io.EOF)
		err = r.Close()
		So(err, ShouldBeNil)
		So(b.String(), ShouldEqual, "67890")
	})

	Convey("Read some and close", t, func() {
		b := bytes.NewBufferString("1234567890")
		r := newLimitReader(b, 5)
		p := make([]byte, 3)
		n, err := r.Read(p)
		So(err, ShouldBeNil)
		So(string(p[:n]), ShouldEqual, "123")
		err = r.Close()
		So(err, ShouldBeNil)
		So(b.String(), ShouldEqual, "67890")
		err = r.Close()
		So(err, ShouldBeNil)
	})

	Convey("Close with error", t, func() {
		er := errorReader{}
		r := newLimitReader(er, 5)
		err := r.Close()
		So(err, ShouldNotBeNil)
	})
}

type errorReader struct{}

func (r errorReader) Read(p []byte) (int, error) {
	return 0, errors.New("error")
}

func (r errorReader) Close() error {
	return errors.New("error")
}
