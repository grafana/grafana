package logproto

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var (
	now    = time.Now().UTC()
	line   = `level=info ts=2019-12-12T15:00:08.325Z caller=compact.go:441 component=tsdb msg="compact blocks" count=3 mint=1576130400000 maxt=1576152000000 ulid=01DVX9ZHNM71GRCJS7M34Q0EV7 sources="[01DVWNC6NWY1A60AZV3Z6DGS65 01DVWW7XXX75GHA6ZDTD170CSZ 01DVX33N5W86CWJJVRPAVXJRWJ]" duration=2.897213221s`
	stream = Stream{
		Labels: `{job="foobar", cluster="foo-central1", namespace="bar", container_name="buzz"}`,
		Hash:   1234*10 ^ 9,
		Entries: []Entry{
			{Timestamp: now, Line: line},
			{Timestamp: now.Add(1 * time.Second), Line: line},
			{Timestamp: now.Add(2 * time.Second), Line: line},
			{Timestamp: now.Add(3 * time.Second), Line: line},
		},
	}
	streamAdapter = StreamAdapter{
		Labels: `{job="foobar", cluster="foo-central1", namespace="bar", container_name="buzz"}`,
		Hash:   1234*10 ^ 9,
		Entries: []EntryAdapter{
			{Timestamp: now, Line: line},
			{Timestamp: now.Add(1 * time.Second), Line: line},
			{Timestamp: now.Add(2 * time.Second), Line: line},
			{Timestamp: now.Add(3 * time.Second), Line: line},
		},
	}
)

func TestStream(t *testing.T) {
	avg := testing.AllocsPerRun(200, func() {
		b, err := stream.Marshal()
		require.NoError(t, err)

		var newStream Stream
		err = newStream.Unmarshal(b)
		require.NoError(t, err)

		require.Equal(t, stream, newStream)
	})
	t.Log("avg allocs per run:", avg)
}

func TestStreamAdapter(t *testing.T) {
	avg := testing.AllocsPerRun(200, func() {
		b, err := streamAdapter.Marshal()
		require.NoError(t, err)

		var newStream StreamAdapter
		err = newStream.Unmarshal(b)
		require.NoError(t, err)

		require.Equal(t, streamAdapter, newStream)
	})
	t.Log("avg allocs per run:", avg)
}

func TestCompatibility(t *testing.T) {
	b, err := stream.Marshal()
	require.NoError(t, err)

	var adapter StreamAdapter
	err = adapter.Unmarshal(b)
	require.NoError(t, err)
	require.Equal(t, streamAdapter, adapter)

	ba, err := adapter.Marshal()
	require.NoError(t, err)
	require.Equal(t, b, ba)

	var newStream Stream
	err = newStream.Unmarshal(ba)
	require.NoError(t, err)

	require.Equal(t, stream, newStream)
}

func BenchmarkStream(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		by, err := stream.Marshal()
		if err != nil {
			b.Fatal(err)
		}
		var newStream Stream
		err = newStream.Unmarshal(by)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkStreamAdapter(b *testing.B) {
	b.ReportAllocs()
	for n := 0; n < b.N; n++ {
		by, err := streamAdapter.Marshal()
		if err != nil {
			b.Fatal(err)
		}
		var newStream StreamAdapter
		err = newStream.Unmarshal(by)
		if err != nil {
			b.Fatal(err)
		}
	}
}
