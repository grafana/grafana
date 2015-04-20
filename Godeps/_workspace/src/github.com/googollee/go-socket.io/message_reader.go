package socketio

import (
	"bufio"
)

type messageReader struct {
	reader    *bufio.Reader
	message   string
	firstRead bool
}

func newMessageReader(bufr *bufio.Reader) (*messageReader, error) {
	if _, err := bufr.ReadBytes('"'); err != nil {
		return nil, err
	}
	msg, err := bufr.ReadBytes('"')
	if err != nil {
		return nil, err
	}
	for {
		b, err := bufr.Peek(1)
		if err != nil {
			return nil, err
		}
		if b[0] == ',' {
			bufr.ReadByte()
			break
		}
		if b[0] != ' ' {
			break
		}
		bufr.ReadByte()
	}
	return &messageReader{
		reader:    bufr,
		message:   string(msg[:len(msg)-1]),
		firstRead: true,
	}, nil
}

func (r *messageReader) Message() string {
	return r.message
}

func (r *messageReader) Read(b []byte) (int, error) {
	if len(b) == 0 {
		return 0, nil
	}
	if r.firstRead {
		r.firstRead = false
		b[0] = '['
		n, err := r.reader.Read(b[1:])
		if err != nil {
			return -1, err
		}
		return n + 1, err
	}
	return r.reader.Read(b)
}
