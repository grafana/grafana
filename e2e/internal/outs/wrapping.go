package outs

import (
	"bytes"
	"io"
	"os"
	"sync"
)

const (
	ResetColor  = "\033[0m"
	YellowColor = "\033[0;33m"
	CyanColor   = "\033[0;36m"
)

func Prefix(w io.Writer, name, colour string) io.Writer {
	if _, ok := os.LookupEnv("CI"); ok {
		return newWrappingOutput(name+": ", "", w)
	}

	return newWrappingOutput(colour+name+": ", ResetColor, w)
}

var _ io.Writer = (*wrappingOutput)(nil)

type wrappingOutput struct {
	prefix        string
	suffix        string
	mu            *sync.Mutex
	inner         io.Writer
	writtenPrefix bool
}

func newWrappingOutput(prefix, suffix string, inner io.Writer) *wrappingOutput {
	return &wrappingOutput{
		prefix: prefix,
		suffix: suffix,
		mu:     &sync.Mutex{},
		inner:  inner,
	}
}

func (p *wrappingOutput) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for line := range bytes.Lines(b) {
		if !p.writtenPrefix {
			if _, err := p.inner.Write([]byte(p.prefix)); err != nil {
				return 0, err
			}
			p.writtenPrefix = true
		}
		if _, err := p.inner.Write(line); err != nil {
			return 0, err
		}
		if bytes.HasSuffix(line, []byte("\n")) {
			p.writtenPrefix = false
			if _, err := p.inner.Write([]byte(p.suffix)); err != nil {
				return 0, err
			}
		}
	}
	return len(b), nil
}
