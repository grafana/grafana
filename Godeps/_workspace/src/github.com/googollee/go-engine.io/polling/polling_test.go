package polling

import (
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/googollee/go-engine.io/message"
	"github.com/googollee/go-engine.io/parser"
	"github.com/googollee/go-engine.io/transport"
	. "github.com/smartystreets/goconvey/convey"
)

func TestPolling(t *testing.T) {

	Convey("Normal", t, func() {
		s := newServer()
		server := httptest.NewServer(s)
		defer server.Close()

		req, err := http.NewRequest("GET", server.URL, nil)
		So(err, ShouldBeNil)
		client, err := NewClient(req)
		So(err, ShouldBeNil)

		So(client.Response(), ShouldBeNil)

		sync := make(chan int)

		go func() {
			<-s.callback.onPacket
			sync <- 1
		}()

		{
			w, err := client.NextWriter(message.MessageBinary, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("123"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			<-sync
			So(s.callback.messageType, ShouldEqual, message.MessageBinary)
			So(s.callback.packetType, ShouldEqual, parser.MESSAGE)
			So(s.callback.body, ShouldResemble, []byte("123"))
		}

		So(client.Response(), ShouldNotBeNil)
		So(client.Response().StatusCode, ShouldEqual, http.StatusOK)
		So(client.Response().Header.Get("Custom"), ShouldEqual, "value")

		{
			w, err := s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc1"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)

			w, err = s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc2"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			r, err := client.NextReader()
			So(err, ShouldBeNil)
			b, err := ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc1"))
			err = r.Close()
			So(err, ShouldBeNil)

			r, err = client.NextReader()
			So(err, ShouldBeNil)
			b, err = ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc2"))
			err = r.Close()
			So(err, ShouldBeNil)
		}

		{
			w, err := s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			r, err := client.NextReader()
			So(err, ShouldBeNil)
			b, err := ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc"))
			err = r.Close()
			So(err, ShouldBeNil)
		}

		client.Close()
	})

	Convey("Normal b64", t, func() {
		s := newServer()
		server := httptest.NewServer(s)
		defer server.Close()

		req, err := http.NewRequest("GET", server.URL+"?b64", nil)
		So(err, ShouldBeNil)
		client, err := NewClient(req)
		So(err, ShouldBeNil)

		So(client.Response(), ShouldBeNil)

		sync := make(chan int)

		go func() {
			<-s.callback.onPacket
			sync <- 1
		}()

		{
			w, err := client.NextWriter(message.MessageBinary, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("123"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			<-sync
			So(s.callback.messageType, ShouldEqual, message.MessageBinary)
			So(s.callback.packetType, ShouldEqual, parser.MESSAGE)
			So(s.callback.body, ShouldResemble, []byte("123"))
		}

		So(client.Response(), ShouldNotBeNil)
		So(client.Response().StatusCode, ShouldEqual, http.StatusOK)
		So(client.Response().Header.Get("Custom"), ShouldEqual, "value")

		{
			w, err := s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc1"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)

			w, err = s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc2"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			r, err := client.NextReader()
			So(err, ShouldBeNil)
			b, err := ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc1"))
			err = r.Close()
			So(err, ShouldBeNil)

			r, err = client.NextReader()
			So(err, ShouldBeNil)
			b, err = ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc2"))
			err = r.Close()
			So(err, ShouldBeNil)
		}

		{
			w, err := s.server.NextWriter(message.MessageText, parser.MESSAGE)
			So(err, ShouldBeNil)
			_, err = w.Write([]byte("abc"))
			So(err, ShouldBeNil)
			err = w.Close()
			So(err, ShouldBeNil)
		}

		{
			r, err := client.NextReader()
			So(err, ShouldBeNil)
			b, err := ioutil.ReadAll(r)
			So(err, ShouldBeNil)
			So(b, ShouldResemble, []byte("abc"))
			err = r.Close()
			So(err, ShouldBeNil)
		}

		client.Close()
	})

}

type server struct {
	server   transport.Server
	callback *fakeCallback
}

func newServer() *server {
	return &server{
		callback: newFakeCallback(),
	}
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if s.server == nil {
		var err error
		s.server, err = NewServer(w, r, s.callback)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.Header().Set("Custom", "value")
	s.server.ServeHTTP(w, r)
}
