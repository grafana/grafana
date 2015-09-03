package nsq

import (
	"bytes"
	"testing"
)

func BenchmarkCommand(b *testing.B) {
	b.StopTimer()
	data := make([]byte, 2048)
	cmd := Publish("test", data)
	var buf bytes.Buffer
	b.StartTimer()

	for i := 0; i < b.N; i++ {
		cmd.WriteTo(&buf)
	}
}
