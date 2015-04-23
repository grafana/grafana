package polling

import (
	"bytes"
	"fmt"
	"github.com/googollee/go-engine.io/message"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"time"

	"github.com/googollee/go-engine.io/parser"
	"github.com/googollee/go-engine.io/transport"
)

type client struct {
	req            http.Request
	url            url.URL
	seq            uint
	getResp        *http.Response
	postResp       *http.Response
	resp           *http.Response
	payloadDecoder *parser.PayloadDecoder
	payloadEncoder *parser.PayloadEncoder
	client         *http.Client
	state          state
}

func NewClient(r *http.Request) (transport.Client, error) {
	newEncoder := parser.NewBinaryPayloadEncoder
	if _, ok := r.URL.Query()["b64"]; ok {
		newEncoder = parser.NewStringPayloadEncoder
	}
	ret := &client{
		req:            *r,
		url:            *r.URL,
		seq:            0,
		payloadEncoder: newEncoder(),
		client:         http.DefaultClient,
		state:          stateNormal,
	}
	return ret, nil
}

func (c *client) Response() *http.Response {
	return c.resp
}

func (c *client) NextReader() (*parser.PacketDecoder, error) {
	if c.state != stateNormal {
		return nil, io.EOF
	}
	if c.payloadDecoder != nil {
		ret, err := c.payloadDecoder.Next()
		if err != io.EOF {
			return ret, err
		}
		c.getResp.Body.Close()
		c.payloadDecoder = nil
	}
	req := c.getReq()
	req.Method = "GET"
	var err error
	c.getResp, err = c.client.Do(req)
	if err != nil {
		return nil, err
	}
	if c.resp == nil {
		c.resp = c.getResp
	}
	c.payloadDecoder = parser.NewPayloadDecoder(c.getResp.Body)
	return c.payloadDecoder.Next()
}

func (c *client) NextWriter(messageType message.MessageType, packetType parser.PacketType) (io.WriteCloser, error) {
	if c.state != stateNormal {
		return nil, io.EOF
	}
	next := c.payloadEncoder.NextBinary
	if messageType == message.MessageText {
		next = c.payloadEncoder.NextString
	}
	w, err := next(packetType)
	if err != nil {
		return nil, err
	}
	return newClientWriter(c, w), nil
}

func (c *client) Close() error {
	if c.state != stateNormal {
		return nil
	}
	c.state = stateClosed
	return nil
}

func (c *client) getReq() *http.Request {
	req := c.req
	url := c.url
	req.URL = &url
	query := req.URL.Query()
	query.Set("t", fmt.Sprintf("%d-%d", time.Now().Unix()*1000, c.seq))
	c.seq++
	req.URL.RawQuery = query.Encode()
	return &req
}

func (c *client) doPost() error {
	if c.state != stateNormal {
		return io.EOF
	}
	req := c.getReq()
	req.Method = "POST"
	buf := bytes.NewBuffer(nil)
	if err := c.payloadEncoder.EncodeTo(buf); err != nil {
		return err
	}
	req.Body = ioutil.NopCloser(buf)
	var err error
	c.postResp, err = c.client.Do(req)
	if err != nil {
		return err
	}
	if c.resp == nil {
		c.resp = c.postResp
	}
	return nil
}

type clientWriter struct {
	io.WriteCloser
	client *client
}

func newClientWriter(c *client, w io.WriteCloser) io.WriteCloser {
	return &clientWriter{
		WriteCloser: w,
		client:      c,
	}
}

func (w *clientWriter) Close() error {
	if err := w.WriteCloser.Close(); err != nil {
		return err
	}
	return w.client.doPost()
}
