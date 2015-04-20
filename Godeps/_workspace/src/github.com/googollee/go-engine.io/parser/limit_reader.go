package parser

import (
	"io"
)

type limitReader struct {
	io.Reader
	remain int
}

func newLimitReader(r io.Reader, limit int) *limitReader {
	return &limitReader{
		Reader: r,
		remain: limit,
	}
}

func (r *limitReader) Read(b []byte) (int, error) {
	if r.remain == 0 {
		return 0, io.EOF
	}
	if len(b) > r.remain {
		b = b[:r.remain]
	}
	n, err := r.Reader.Read(b)
	r.remain -= n
	return n, err
}

func (r *limitReader) Close() error {
	if r.remain > 0 {
		b := make([]byte, 10240)
		for {
			_, err := r.Read(b)
			if err == io.EOF {
				break
			}
			if err != nil {
				return err
			}
		}
	}
	return nil
}
