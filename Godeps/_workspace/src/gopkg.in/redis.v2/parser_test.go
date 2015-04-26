package redis

import (
	"testing"

	"gopkg.in/bufio.v1"
)

func BenchmarkParseReplyStatus(b *testing.B) {
	benchmarkParseReply(b, "+OK\r\n", nil, false)
}

func BenchmarkParseReplyInt(b *testing.B) {
	benchmarkParseReply(b, ":1\r\n", nil, false)
}

func BenchmarkParseReplyError(b *testing.B) {
	benchmarkParseReply(b, "-Error message\r\n", nil, true)
}

func BenchmarkParseReplyString(b *testing.B) {
	benchmarkParseReply(b, "$5\r\nhello\r\n", nil, false)
}

func BenchmarkParseReplySlice(b *testing.B) {
	benchmarkParseReply(b, "*2\r\n$5\r\nhello\r\n$5\r\nworld\r\n", parseSlice, false)
}

func benchmarkParseReply(b *testing.B, reply string, p multiBulkParser, wanterr bool) {
	b.StopTimer()

	buf := &bufio.Buffer{}
	rd := bufio.NewReader(buf)
	for i := 0; i < b.N; i++ {
		buf.WriteString(reply)
	}

	b.StartTimer()

	for i := 0; i < b.N; i++ {
		_, err := parseReply(rd, p)
		if !wanterr && err != nil {
			panic(err)
		}
	}
}

func BenchmarkAppendArgs(b *testing.B) {
	buf := make([]byte, 0, 64)
	args := []string{"hello", "world", "foo", "bar"}
	for i := 0; i < b.N; i++ {
		appendArgs(buf, args)
	}
}
