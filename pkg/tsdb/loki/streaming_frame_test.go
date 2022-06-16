package loki

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLokiFramer(t *testing.T) {
	t.Run("converting metric name", func(t *testing.T) {
		msg := []byte(`{"streams":[
			{"stream":
			  {"job":"node-exporter","metric":"go_memstats_heap_inuse_bytes"},
			  "values":[
				["1642091525267322910","line1"]
			  ]},
			{"stream":
			  {"job":"node-exporter","metric":"go_memstats_heap_inuse_bytes"},
			  "values":[
				  ["1642091525770585774","line2"],
				  ["1642091525770585775","line3"]
			  ]},
			{"stream":
			  {"metric":"go_memstats_heap_inuse_bytes","job":"node-exporter"},
			  "values":[
				  ["1642091526263785281","line4"]
			   ]}
			]}`)

		frame, err := lokiBytesToLabeledFrame(msg)
		require.NoError(t, err)

		lines := frame.Fields[2]
		require.Equal(t, 4, lines.Len())
		require.Equal(t, "line1", lines.At(0))
		require.Equal(t, "line2", lines.At(1))
		require.Equal(t, "line3", lines.At(2))
		require.Equal(t, "line4", lines.At(3))
	})
}
