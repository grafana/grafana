package parser

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"strconv"
	"sync"
)

// payloadEncoder is the encoder to encode packets as payload. It can be used in multi-thread.
type PayloadEncoder struct {
	buffers  [][]byte
	locker   sync.Mutex
	isString bool
}

// NewStringPayloadEncoder returns the encoder which encode as string.
func NewStringPayloadEncoder() *PayloadEncoder {
	return &PayloadEncoder{
		isString: true,
	}
}

// NewStringPayloadEncoder returns the encoder which encode as binary.
func NewBinaryPayloadEncoder() *PayloadEncoder {
	return &PayloadEncoder{
		isString: false,
	}
}

type encoder struct {
	*PacketEncoder
	buf          *bytes.Buffer
	binaryPrefix string
	payload      *PayloadEncoder
}

func (e encoder) Close() error {
	if err := e.PacketEncoder.Close(); err != nil {
		return err
	}
	var buffer []byte
	if e.payload.isString {
		buffer = []byte(fmt.Sprintf("%d:%s", e.buf.Len(), e.buf.String()))
	} else {
		buffer = []byte(fmt.Sprintf("%s%d", e.binaryPrefix, e.buf.Len()))
		for i, n := 0, len(buffer); i < n; i++ {
			buffer[i] = buffer[i] - '0'
		}
		buffer = append(buffer, 0xff)
		buffer = append(buffer, e.buf.Bytes()...)
	}

	e.payload.locker.Lock()
	e.payload.buffers = append(e.payload.buffers, buffer)
	e.payload.locker.Unlock()

	return nil
}

// NextString returns the encoder with packet type t and encode as string.
func (e *PayloadEncoder) NextString(t PacketType) (io.WriteCloser, error) {
	buf := bytes.NewBuffer(nil)
	pEncoder, err := NewStringEncoder(buf, t)
	if err != nil {
		return nil, err
	}
	return encoder{
		PacketEncoder: pEncoder,
		buf:           buf,
		binaryPrefix:  "0",
		payload:       e,
	}, nil
}

// NextBinary returns the encoder with packet type t and encode as binary.
func (e *PayloadEncoder) NextBinary(t PacketType) (io.WriteCloser, error) {
	buf := bytes.NewBuffer(nil)
	var pEncoder *PacketEncoder
	var err error
	if e.isString {
		pEncoder, err = NewB64Encoder(buf, t)
	} else {
		pEncoder, err = NewBinaryEncoder(buf, t)
	}
	if err != nil {
		return nil, err
	}
	return encoder{
		PacketEncoder: pEncoder,
		buf:           buf,
		binaryPrefix:  "1",
		payload:       e,
	}, nil
}

// EncodeTo writes encoded payload to writer w. It will clear the buffer of encoder.
func (e *PayloadEncoder) EncodeTo(w io.Writer) error {
	e.locker.Lock()
	buffers := e.buffers
	e.buffers = nil
	e.locker.Unlock()

	for _, b := range buffers {
		for len(b) > 0 {
			n, err := w.Write(b)
			if err != nil {
				return err
			}
			b = b[n:]
		}
	}
	return nil
}

//IsString returns true if payload encode to string, otherwise returns false.
func (e *PayloadEncoder) IsString() bool {
	return e.isString
}

// payloadDecoder is the decoder to decode payload.
type PayloadDecoder struct {
	r *bufio.Reader
}

// NewPaylaodDecoder returns the payload decoder which read from reader r.
func NewPayloadDecoder(r io.Reader) *PayloadDecoder {
	br, ok := r.(*bufio.Reader)
	if !ok {
		br = bufio.NewReader(r)
	}
	return &PayloadDecoder{
		r: br,
	}
}

// Next returns the packet decoder. Make sure it will be closed after used.
func (d *PayloadDecoder) Next() (*PacketDecoder, error) {
	firstByte, err := d.r.Peek(1)
	if err != nil {
		return nil, err
	}
	isBinary := firstByte[0] < '0'
	delim := byte(':')
	if isBinary {
		d.r.ReadByte()
		delim = 0xff
	}
	line, err := d.r.ReadBytes(delim)
	if err != nil {
		return nil, err
	}
	l := len(line)
	if l < 1 {
		return nil, fmt.Errorf("invalid input")
	}
	lenByte := line[:l-1]
	if isBinary {
		for i, n := 0, l; i < n; i++ {
			line[i] = line[i] + '0'
		}
	}
	packetLen, err := strconv.ParseInt(string(lenByte), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid input")
	}
	return NewDecoder(newLimitReader(d.r, int(packetLen)))
}
