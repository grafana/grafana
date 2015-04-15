package polling

import (
	"bytes"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestWriter(t *testing.T) {
	p := &Polling{
		state:    stateNormal,
		sendChan: MakeSendChan(),
	}
	sendChan := p.sendChan

	Convey("Wait close", t, func() {
		w := newFakeWriteCloser()

		select {
		case <-sendChan:
			panic("should not run here")
		default:
		}

		writer := NewWriter(w, p)
		err := writer.Close()
		So(err, ShouldBeNil)

		select {
		case <-sendChan:
		default:
			panic("should not run here")
		}

		select {
		case <-sendChan:
			panic("should not run here")
		default:
		}
	})

	Convey("Many writer with close", t, func() {
		for i := 0; i < 10; i++ {
			w := newFakeWriteCloser()
			writer := NewWriter(w, p)
			err := writer.Close()
			So(err, ShouldBeNil)
		}

		select {
		case <-sendChan:
		default:
			panic("should not run here")
		}

		select {
		case <-sendChan:
			panic("should not run here")
		default:
		}
	})

	Convey("Close with not normal", t, func() {
		p := &Polling{
			state:    stateClosing,
			sendChan: MakeSendChan(),
		}

		w := newFakeWriteCloser()
		writer := NewWriter(w, p)
		err := writer.Close()
		So(err, ShouldNotBeNil)
	})
}

type fakeWriteCloser struct {
	*bytes.Buffer
}

func newFakeWriteCloser() *fakeWriteCloser {
	return &fakeWriteCloser{
		Buffer: bytes.NewBuffer(nil),
	}
}

func (f *fakeWriteCloser) Close() error {
	return nil
}
