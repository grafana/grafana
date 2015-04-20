package parser

import (
	"encoding/base64"
	"fmt"
	"io"

	"github.com/googollee/go-engine.io/message"
)

// PacketType is the type of packet
type PacketType string

const (
	OPEN    PacketType = "open"
	CLOSE   PacketType = "close"
	PING    PacketType = "ping"
	PONG    PacketType = "pong"
	MESSAGE PacketType = "message"
	UPGRADE PacketType = "upgrade"
	NOOP    PacketType = "noop"
)

func ByteToType(b byte) (PacketType, error) {
	switch b {
	case 0:
		return OPEN, nil
	case 1:
		return CLOSE, nil
	case 2:
		return PING, nil
	case 3:
		return PONG, nil
	case 4:
		return MESSAGE, nil
	case 5:
		return UPGRADE, nil
	case 6:
		return NOOP, nil
	}
	return NOOP, fmt.Errorf("invalid byte 0x%x", b)
}

// Byte return the byte of type
func (t PacketType) Byte() byte {
	switch t {
	case OPEN:
		return 0
	case CLOSE:
		return 1
	case PING:
		return 2
	case PONG:
		return 3
	case MESSAGE:
		return 4
	case UPGRADE:
		return 5
	}
	return 6
}

// packetEncoder is the encoder which encode the packet.
type PacketEncoder struct {
	closer io.Closer
	w      io.Writer
}

// NewStringEncoder return the encoder which encode type t to writer w, as string.
func NewStringEncoder(w io.Writer, t PacketType) (*PacketEncoder, error) {
	return newEncoder(w, t.Byte()+'0')
}

// NewBinaryEncoder return the encoder which encode type t to writer w, as binary.
func NewBinaryEncoder(w io.Writer, t PacketType) (*PacketEncoder, error) {
	return newEncoder(w, t.Byte())
}

func newEncoder(w io.Writer, t byte) (*PacketEncoder, error) {
	if _, err := w.Write([]byte{t}); err != nil {
		return nil, err
	}
	closer, ok := w.(io.Closer)
	if !ok {
		closer = nil
	}
	return &PacketEncoder{
		closer: closer,
		w:      w,
	}, nil
}

// NewB64Encoder return the encoder which encode type t to writer w, as string. When write binary, it uses base64.
func NewB64Encoder(w io.Writer, t PacketType) (*PacketEncoder, error) {
	_, err := w.Write([]byte{'b', t.Byte() + '0'})
	if err != nil {
		return nil, err
	}
	base := base64.NewEncoder(base64.StdEncoding, w)
	return &PacketEncoder{
		closer: base,
		w:      base,
	}, nil
}

// Write writes bytes p.
func (e *PacketEncoder) Write(p []byte) (int, error) {
	return e.w.Write(p)
}

// Close closes the encoder.
func (e *PacketEncoder) Close() error {
	if e.closer != nil {
		return e.closer.Close()
	}
	return nil
}

// packetDecoder is the decoder which decode data to packet.
type PacketDecoder struct {
	closer  io.Closer
	r       io.Reader
	t       PacketType
	msgType message.MessageType
}

// NewDecoder return the decoder which decode from reader r.
func NewDecoder(r io.Reader) (*PacketDecoder, error) {
	var closer io.Closer
	if limit, ok := r.(*limitReader); ok {
		closer = limit
	}
	defer func() {
		if closer != nil {
			closer.Close()
		}
	}()

	b := []byte{0xff}
	if _, err := r.Read(b); err != nil {
		return nil, err
	}
	msgType := message.MessageText
	if b[0] == 'b' {
		if _, err := r.Read(b); err != nil {
			return nil, err
		}
		r = base64.NewDecoder(base64.StdEncoding, r)
		msgType = message.MessageBinary
	}
	if b[0] >= '0' {
		b[0] = b[0] - '0'
	} else {
		msgType = message.MessageBinary
	}
	t, err := ByteToType(b[0])
	if err != nil {
		return nil, err
	}
	ret := &PacketDecoder{
		closer:  closer,
		r:       r,
		t:       t,
		msgType: msgType,
	}
	closer = nil
	return ret, nil
}

// Read reads packet data to bytes p.
func (d *PacketDecoder) Read(p []byte) (int, error) {
	return d.r.Read(p)
}

// Type returns the type of packet.
func (d *PacketDecoder) Type() PacketType {
	return d.t
}

// MessageType returns the type of message, binary or string.
func (d *PacketDecoder) MessageType() message.MessageType {
	return d.msgType
}

// Close closes the decoder.
func (d *PacketDecoder) Close() error {
	if d.closer != nil {
		return d.closer.Close()
	}
	return nil
}
